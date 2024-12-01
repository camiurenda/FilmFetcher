const express = require('express');
const Site = require('../models/site.model');
const scheduleService = require('../services/schedule.service');
const ScrapingHistory = require('../models/scrapingHistory.model');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        console.log('Obteniendo todos los sitios habilitados');
        const sites = await Site.find({ habilitado: true });
        res.status(200).json(sites || []);
    } catch (error) {
        console.error('Error al obtener sitios:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/manual', async (req, res) => {
    try {
        console.log('Obteniendo sitios de carga manual');
        const sitios = await Site.find({ tipoCarga: 'manual', habilitado: true });
        res.status(200).json(sitios);
    } catch (error) {
        console.error('Error al obtener sitios manuales:', error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/add', async (req, res) => {
    try {
        console.log('Datos recibidos para nuevo sitio:', req.body);
        const { 
            nombre, url, direccion, tipo, tipoCarga, 
            tipoFrecuencia, configuracion, usuarioCreador 
        } = req.body;

        if (!nombre || !url || !tipoCarga || !usuarioCreador) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }

        const newSite = new Site({
            nombre,
            url,
            direccion,
            tipo,
            tipoCarga,
            usuarioCreador,
            habilitado: true,
            activoParaScraping: tipoCarga === 'scraping'
        });

        const savedSite = await newSite.save();

        if (tipoCarga === 'scraping' && tipoFrecuencia && configuracion) {
            try {
                await scheduleService.agregarSchedule(savedSite._id, {
                    tipoFrecuencia,
                    hora: configuracion.hora,
                    diasSemana: configuracion.diasSemana,
                    diaMes: configuracion.diaMes
                });
            } catch (scheduleError) {
                console.error('Error al crear schedule:', scheduleError);
                // No fallamos la creación del sitio si falla el schedule
            }
        }

        console.log('Sitio guardado exitosamente:', savedSite._id);
        res.status(201).json(savedSite);
    } catch (error) {
        console.error('Error al guardar el sitio:', error);
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        console.log('Actualizando sitio:', req.params.id);
        const { id } = req.params;
        const updateData = { ...req.body };

        // Extraer datos de scheduling
        const scheduleData = {
            tipoFrecuencia: updateData.tipoFrecuencia,
            configuracion: {
                hora: updateData.configuracion?.hora,
                diasSemana: updateData.configuracion?.diasSemana || [],
                diaMes: updateData.configuracion?.diaMes
            }
        };

        // Limpiar datos que no pertenecen al modelo Site
        delete updateData.tipoFrecuencia;
        delete updateData.configuracion;

        const updatedSite = await Site.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedSite) {
            return res.status(404).json({ message: 'Sitio no encontrado' });
        }

        // Si es sitio de scraping, actualizar schedule
        if (updateData.tipoCarga === 'scraping' && scheduleData.tipoFrecuencia) {
            try {
                await scheduleService.agregarSchedule(updatedSite._id, scheduleData);
            } catch (scheduleError) {
                console.error('Error al actualizar schedule:', scheduleError);
            }
        }

        res.status(200).json(updatedSite);
    } catch (error) {
        console.error('Error al actualizar el sitio:', error);
        res.status(400).json({ message: error.message });
    }
});

router.put('/disable/:id', async (req, res) => {
    try {
        console.log('Deshabilitando sitio:', req.params.id);
        const updatedSite = await Site.findByIdAndUpdate(
            req.params.id,
            { habilitado: false },
            { new: true }
        );

        if (!updatedSite) {
            return res.status(404).json({ message: 'Sitio no encontrado' });
        }

        // Pausar schedule si existe
        try {
            await scheduleService.pausarSchedule(req.params.id);
        } catch (scheduleError) {
            console.error('Error al pausar schedule:', scheduleError);
        }

        res.status(200).json(updatedSite);
    } catch (error) {
        console.error('Error al deshabilitar sitio:', error);
        res.status(400).json({ message: error.message });
    }
});

router.put('/enable/:id', async (req, res) => {
    try {
        console.log('Habilitando sitio:', req.params.id);
        const updatedSite = await Site.findByIdAndUpdate(
            req.params.id,
            { habilitado: true },
            { new: true }
        );

        if (!updatedSite) {
            return res.status(404).json({ message: 'Sitio no encontrado' });
        }

        // Reanudar schedule si el sitio es de scraping
        if (updatedSite.tipoCarga === 'scraping') {
            try {
                await scheduleService.reanudarSchedule(req.params.id);
            } catch (scheduleError) {
                console.error('Error al reanudar schedule:', scheduleError);
            }
        }

        res.status(200).json(updatedSite);
    } catch (error) {
        console.error('Error al habilitar sitio:', error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/scraping-history', async (req, res) => {
    try {
        console.log('Obteniendo historial de scraping');
        const history = await ScrapingHistory.find()
            .populate('siteId', 'nombre')
            .sort({ fechaScraping: -1 });
        res.status(200).json(history);
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        console.log('Obteniendo sitio por ID:', req.params.id);
        const site = await Site.findById(req.params.id);
        if (!site) {
            return res.status(404).json({ message: 'Sitio no encontrado' });
        }
        res.status(200).json(site);
    } catch (error) {
        console.error('Error al obtener sitio:', error);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;