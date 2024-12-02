const express = require('express');
const Site = require('../models/site.model');
const scheduleService = require('../services/schedule.service');
const ScrapingHistory = require('../models/scrapingHistory.model');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log('Obteniendo schedules activos');
        const schedules = await ScrapingSchedule.find({ activo: true })
            .populate('sitioId')
            .sort({ proximaEjecucion: 1 });

        console.log(`Encontrados ${schedules.length} schedules activos`);
        res.status(200).json(schedules || []);
    } catch (error) {
        console.error('Error al obtener schedules:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        console.log('Recibida solicitud para crear nuevo schedule:', req.body);
        const { sitioId, tipoFrecuencia, configuraciones } = req.body;

        if (!sitioId || !tipoFrecuencia || !configuraciones) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }

        // Desactivar schedules existentes para este sitio
        await ScrapingSchedule.updateMany(
            { sitioId, activo: true },
            { activo: false }
        );

        const nuevoSchedule = new ScrapingSchedule({
            sitioId,
            tipoFrecuencia,
            configuraciones,
            activo: true
        });

        await nuevoSchedule.save();
        console.log('Schedule creado:', nuevoSchedule._id);
        res.status(201).json(nuevoSchedule);
    } catch (error) {
        console.error('Error al crear schedule:', error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/sitio/:sitioId', async (req, res) => {
    try {
        console.log('Buscando schedule para sitio:', req.params.sitioId);
        const schedule = await ScrapingSchedule.findOne({ 
            sitioId: req.params.sitioId,
            activo: true 
        }).populate('sitioId');

        if (!schedule) {
            console.log('No se encontró schedule activo para el sitio');
            return res.status(404).json({ message: 'Schedule no encontrado' });
        }

        console.log('Schedule encontrado:', schedule._id);
        res.json(schedule);
    } catch (error) {
        console.error('Error al buscar schedule:', error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        console.log('Actualizando schedule:', req.params.id);
        const actualizaciones = { ...req.body };
        
        const scheduleActualizado = await ScrapingSchedule.findByIdAndUpdate(
            req.params.id,
            actualizaciones,
            { new: true, runValidators: true }
        ).populate('sitioId');

        if (!scheduleActualizado) {
            return res.status(404).json({ message: 'Schedule no encontrado' });
        }

        console.log('Schedule actualizado exitosamente');
        res.json(scheduleActualizado);
    } catch (error) {
        console.error('Error al actualizar schedule:', error);
        res.status(400).json({ message: error.message });
    }
});

router.post('/:id/pausar', async (req, res) => {
    try {
        console.log('Pausando schedule:', req.params.id);
        const schedule = await ScrapingSchedule.findByIdAndUpdate(
            req.params.id,
            { activo: false },
            { new: true }
        ).populate('sitioId');

        if (!schedule) {
            return res.status(404).json({ message: 'Schedule no encontrado' });
        }

        console.log('Schedule pausado exitosamente');
        res.json(schedule);
    } catch (error) {
        console.error('Error al pausar schedule:', error);
        res.status(400).json({ message: error.message });
    }
});

router.post('/:id/reanudar', async (req, res) => {
    try {
        console.log('Reanudando schedule:', req.params.id);
        const schedule = await ScrapingSchedule.findByIdAndUpdate(
            req.params.id,
            { 
                activo: true,
                'bloqueo.bloqueado': false,
                intentosFallidos: 0,
                ultimoError: null
            },
            { new: true }
        ).populate('sitioId');

        if (!schedule) {
            return res.status(404).json({ message: 'Schedule no encontrado' });
        }

        // Recalcular próxima ejecución
        schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
        await schedule.save();

        console.log('Schedule reactivado exitosamente');
        res.json(schedule);
    } catch (error) {
        console.error('Error al reanudar schedule:', error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/cola/estado', async (req, res) => {
    try {
        console.log('Consultando estado de la cola de schedules');
        const jobsEnCola = await ScrapingSchedule.countDocuments({ 
            activo: true,
            'bloqueo.bloqueado': false 
        });

        const jobsEnEjecucion = await ScrapingSchedule.find({
            activo: true,
            'bloqueo.bloqueado': false,
            ultimaEjecucion: { $exists: true }
        }).populate('sitioId', 'nombre');

        const proximoJob = await ScrapingSchedule.findOne({
            activo: true,
            'bloqueo.bloqueado': false
        })
        .sort({ proximaEjecucion: 1 })
        .populate('sitioId', 'nombre');

        const respuesta = {
            jobsEnCola,
            jobsEnEjecucion: jobsEnEjecucion.map(job => ({
                id: job._id,
                sitio: job.sitioId?.nombre || 'Desconocido',
                proximaEjecucion: job.proximaEjecucion
            })),
            proximaEjecucion: proximoJob?.proximaEjecucion
        };

        console.log('Estado de cola:', {
            jobsEnCola,
            jobsEnEjecucion: jobsEnEjecucion.length,
            proximaEjecucion: proximoJob?.proximaEjecucion
        });

        res.json(respuesta);
    } catch (error) {
        console.error('Error al obtener estado de la cola:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;