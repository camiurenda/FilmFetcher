const express = require('express');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const ScrapingQueueService = require('../services/schedule.service');
const router = express.Router();
router.get('/', async (req, res) => {
  console.log('Iniciando GET /api/scraping-schedule');
  try {
    console.log('Intentando buscar schedules en la base de datos...');
    
    // Primero intentamos una búsqueda simple para verificar la conexión
    const count = await ScrapingSchedule.countDocuments();
    console.log(`Número de schedules encontrados: ${count}`);

    // Realizar la búsqueda completa
    const schedules = await ScrapingSchedule.find()
      .populate({
        path: 'sitioId',
        select: 'nombre url tipo'  // Seleccionar solo los campos necesarios
      })
      .lean()
      .exec();

    console.log('Búsqueda completada exitosamente');
    console.log(`Schedules encontrados: ${schedules ? schedules.length : 0}`);

    // Si schedules es null o undefined, devolver array vacío
    const schedulesResponse = schedules || [];
    
    // Log de respuesta
    console.log('Enviando respuesta al cliente');
    res.json(schedulesResponse);
  } catch (error) {
    // Log detallado del error
    console.error('Error detallado en GET /api/scraping-schedule:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });

    // Si es un error de MongoDB, loguear información específica
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.error('Error de MongoDB:', {
        code: error.code,
        codeName: error.codeName,
        errorLabels: error.errorLabels
      });
    }

    res.status(500).json({ 
      mensaje: 'Error al obtener schedules',
      error: error.message,
      tipo: error.name,
      codigo: error.code
    });
  }
});

/**
 * Crear nuevo schedule
 */
router.post('/', async (req, res) => {
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

    // Validar que no exista ya un schedule activo para el sitio
    const scheduleExistente = await ScrapingSchedule.findOne({ 
      sitioId, 
      activo: true 
    });

    if (scheduleExistente) {
      return res.status(400).json({ 
        mensaje: 'Ya existe un schedule activo para este sitio' 
      });
    }

    // Crear nueva configuración
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
    console.error('Error al crear schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al crear schedule',
      error: error.message 
    });
  }
});

/**
 * Obtener schedule específico
 */
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

/**
 * Actualizar schedule
 */
router.put('/:id', async (req, res) => {
  try {
    const scheduleActualizado = await ScrapingQueueService.actualizarJob(
      req.params.id,
      req.body
    );
    res.json(scheduleActualizado);
  } catch (error) {
    console.error('Error al actualizar schedule:', error);
    res.status(500).json({ 
      mensaje: 'Error al actualizar schedule',
      error: error.message 
    });
  }
});

/**
 * Pausar schedule
 */
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

/**
 * Reanudar schedule
 */
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