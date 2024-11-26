const express = require('express');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const ScrapingQueueService = require('../services/schedule.service');
const router = express.Router();

router.get('/', async (req, res) => {
  console.log('Iniciando GET /api/scraping-schedule');
  try {
    console.log('Intentando buscar schedules en la base de datos...');
    
    const count = await ScrapingSchedule.countDocuments();
    console.log(`Número de schedules encontrados: ${count}`);

    const schedules = await ScrapingSchedule.find()
      .populate({
        path: 'sitioId',
        select: 'nombre url tipo'
      })
      .lean()
      .exec();

    console.log('Búsqueda completada exitosamente');
    console.log(`Schedules encontrados: ${schedules ? schedules.length : 0}`);

    const schedulesResponse = schedules || [];
    res.json(schedulesResponse);
  } catch (error) {
    console.error('Error detallado en GET /api/scraping-schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener schedules',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  console.log('Iniciando POST /api/scraping-schedule', req.body);
  try {
    const {
      sitioId,
      tipoFrecuencia,
      hora,
      diasSemana,
      diaMes,
      semanaMes,
      diaSemana,
      scrapingInmediato
    } = req.body;

    const scheduleExistente = await ScrapingSchedule.findOne({ 
      sitioId, 
      activo: true 
    });

    if (scheduleExistente) {
      console.log('Actualizando schedule existente', scheduleExistente._id);
      const scheduleActualizado = await ScrapingQueueService.actualizarSchedule(
        scheduleExistente.sitioId,
        req.body
      );
      return res.json(scheduleActualizado);
    }

    console.log('Creando nuevo schedule');
    const nuevoSchedule = await ScrapingQueueService.agregarJob({
      sitioId,
      tipoFrecuencia,
      hora,
      diasSemana,
      diaMes,
      semanaMes,
      diaSemana,
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

router.get('/:id', async (req, res) => {
  try {
    const schedule = await ScrapingSchedule.findById(req.params.id)
      .populate('sitioId');

    if (!schedule) {
      return res.status(404).json({ 
        mensaje: 'Schedule no encontrado' 
      });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error al obtener schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener schedule',
      error: error.message 
    });
  }
});

router.put('/:id', async (req, res) => {
  console.log('Iniciando PUT /api/scraping-schedule/:id', {
    id: req.params.id,
    body: req.body
  });
  try {
    const scheduleActualizado = await ScrapingQueueService.actualizarSchedule(
      req.params.id,
      req.body
    );
    console.log('Schedule actualizado exitosamente');
    res.json(scheduleActualizado);
  } catch (error) {
    console.error('Error al actualizar schedule:', error);
    res.status(400).json({ 
      mensaje: 'Error al actualizar schedule',
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

router.get('/cola/estado', async (req, res) => {
  console.log('Iniciando GET /api/scraping-schedule/cola/estado');
  try {
    const estadoCola = await ScrapingQueueService.obtenerEstadoCola();
    console.log('Estado de cola obtenido:', estadoCola);
    res.json(estadoCola);
  } catch (error) {
    console.error('Error al obtener estado de la cola:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener estado de la cola',
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

module.exports = router;