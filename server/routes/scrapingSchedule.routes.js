const express = require('express');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const ScrapingQueueService = require('../services/schedule.service');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    console.log('Obteniendo todos los schedules');
    const schedules = await ScrapingSchedule.find()
      .populate('sitioId')
      .lean();
    console.log(`Se encontraron ${schedules.length} schedules`);
    res.json(schedules);
  } catch (error) {
    console.error('Error al obtener schedules:', error);
    res.status(500).json({ error: error.message });
  }
});


router.post('/', async (req, res) => {
  try {
    const {
      sitioId,
      tipoFrecuencia,
      configuraciones,
      fechaInicio,
      fechaFin,
      scrapingInmediato
    } = req.body;

    const scheduleExistente = await ScrapingSchedule.findOne({ 
      sitioId, 
      activo: true 
    });

    if (scheduleExistente) {
      console.log('Actualizando schedule existente', scheduleExistente._id);
      const scheduleActualizado = await ScrapingQueueService.actualizarSchedule(
        scheduleExistente._id,
        req.body
      );
      return res.json(scheduleActualizado);
    }

    console.log('Creando nuevo schedule');
    const nuevoSchedule = await ScrapingQueueService.agregarJob({
      sitioId,
      tipoFrecuencia,
      configuraciones,
      fechaInicio,
      fechaFin,
      scrapingInmediato: scrapingInmediato || false
    });

    res.status(201).json(nuevoSchedule);
  } catch (error) {
    console.error('Error al crear/actualizar schedule:', error);
    res.status(400).json({ 
      mensaje: 'Error al procesar schedule',
      error: error.message 
    });
  }
});

router.get('/cola/estado', async (req, res) => {
  try {
    const estadoCola = await ScrapingQueueService.obtenerEstadoCola();
    res.json(estadoCola);
  } catch (error) {
    console.error('Error al obtener estado de la cola:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estado de la cola',
      error: error.message 
    });
  }
});

router.post('/:id/pausar', async (req, res) => {
  try {
    const schedulePausado = await ScrapingQueueService.pausarJob(req.params.id);
    res.json(schedulePausado);
  } catch (error) {
    console.error('Error al pausar schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al pausar schedule',
      error: error.message 
    });
  }
});

router.post('/:id/reanudar', async (req, res) => {
  try {
    const scheduleReanudado = await ScrapingQueueService.reanudarJob(req.params.id);
    res.json(scheduleReanudado);
  } catch (error) {
    console.error('Error al reanudar schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al reanudar schedule',
      error: error.message 
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const scheduleActualizado = await ScrapingQueueService.actualizarSchedule(
      req.params.id,
      req.body
    );
    res.json(scheduleActualizado);
  } catch (error) {
    console.error('Error al actualizar schedule:', error);
    res.status(400).json({ 
      mensaje: 'Error al actualizar schedule',
      error: error.message 
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    await ScrapingQueueService.actualizarCola();
    res.json({ mensaje: 'Cola actualizada correctamente' });
  } catch (error) {
    console.error('Error al sincronizar schedules:', error);
    res.status(500).json({ 
      mensaje: 'Error al sincronizar schedules',
      error: error.message 
    });
  }
});

router.get('/sitio/:sitioId', async (req, res) => {
  try {
    console.log('Buscando schedule para sitio:', req.params.sitioId);
    const schedule = await ScrapingSchedule.findOne({ sitioId: req.params.sitioId })
      .populate('sitioId');
    
    if (!schedule) {
      console.log('No se encontró schedule para el sitio');
      return res.status(404).json({ message: 'Schedule no encontrado' });
    }

    console.log('Schedule encontrado:', schedule);
    res.json(schedule);
  } catch (error) {
    console.error('Error al obtener schedule por sitio:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;