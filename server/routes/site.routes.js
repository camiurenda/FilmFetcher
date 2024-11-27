const express = require('express');
const Site = require('../models/site.model');
const ScrapingService = require('../services/scraping.service');
const ScrapingHistory = require('../models/scrapingHistory.model');
const ScrapingSchedule = require('../models/scrapingSchedule.model');
const router = express.Router();

// Obtener todos los sitios habilitados
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

// Obtener sitios manuales
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

// Obtener el horario de scraping
router.get('/scraping-schedule', async (req, res) => {
  try {
    console.log('Obteniendo horario de scraping');
    const schedule = await ScrapingService.getSchedule();
    res.status(200).json(schedule);
  } catch (error) {
    console.error('Error al obtener horario de scraping:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener el historial de scraping
router.get('/scraping-history', async (req, res) => {
  try {
    console.log('Obteniendo historial de scraping');
    const history = await ScrapingHistory.find().populate('siteId', 'nombre');
    res.status(200).json(history);
  } catch (error) {
    console.error('Error al obtener historial de scraping:', error);
    res.status(500).json({ message: error.message });
  }
});

// Agregar nuevo sitio
router.post('/add', async (req, res) => {
  try {
    console.log('Datos recibidos para nuevo sitio:', req.body);
    const { 
      nombre, 
      url, 
      direccion, 
      tipo, 
      tipoCarga, 
      tipoFrecuencia,
      configuraciones,
      tags,
      prioridad,
      fechaInicio,
      fechaFin,
      usuarioCreador 
    } = req.body;

    if (!nombre || !url || !tipoCarga || !usuarioCreador) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    if (tipoCarga === 'scraping' && !tipoFrecuencia) {
      return res.status(400).json({ message: 'La frecuencia de actualización es requerida para sitios de scraping' });
    }

    const newSite = new Site({
      nombre,
      url,
      direccion,
      tipo,
      tipoCarga,
      frecuenciaActualizacion: tipoFrecuencia,
      usuarioCreador,
      habilitado: true,
      activoParaScraping: tipoCarga === 'scraping'
    });

    const savedSite = await newSite.save();

    if (tipoCarga === 'scraping' && configuraciones?.length > 0) {
      const newSchedule = new ScrapingSchedule({
        sitioId: savedSite._id,
        tipoFrecuencia,
        configuraciones,
        tags,
        prioridad,
        fechaInicio,
        fechaFin,
        proximaEjecucion: new Date()
      });

      const proximaEjecucion = newSchedule.calcularProximaEjecucion();
      newSchedule.proximaEjecucion = proximaEjecucion;
      await newSchedule.save();
    }

    console.log('Sitio guardado exitosamente:', savedSite._id);
    res.status(201).json(savedSite);
  } catch (error) {
    console.error('Error al guardar el sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

// Deshabilitar un sitio
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
    res.status(200).json(updatedSite);
  } catch (error) {
    console.error('Error al deshabilitar sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

// Habilitar un sitio
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
    res.status(200).json(updatedSite);
  } catch (error) {
    console.error('Error al habilitar sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

// Obtener diagnóstico de scraping
router.get('/scraping-diagnostic', async (req, res) => {
  try {
    console.log('Obteniendo diagnóstico de scraping');
    const diagnosticInfo = await ScrapingService.getDiagnosticInfo();
    res.status(200).json(diagnosticInfo);
  } catch (error) {
    console.error('Error al obtener diagnóstico:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener un sitio por ID
router.get('/:id', async (req, res) => {
  try {
    console.log('Buscando sitio por ID:', req.params.id);
    const site = await Site.findById(req.params.id);
    if (!site) {
      console.log('Sitio no encontrado');
      return res.status(404).json({ message: 'Sitio no encontrado' });
    }

    // Buscar el schedule asociado al sitio
    const schedule = await ScrapingSchedule.findOne({ sitioId: req.params.id });
    const sitioConSchedule = {
      ...site.toObject(),
      tipoFrecuencia: schedule?.tipoFrecuencia,
      configuraciones: schedule?.configuraciones,
      tags: schedule?.tags,
      prioridad: schedule?.prioridad,
      fechaInicio: schedule?.fechaInicio,
      fechaFin: schedule?.fechaFin,
      ultimoError: schedule?.ultimoError,
      bloqueo: schedule?.bloqueo
    };

    console.log('Sitio encontrado:', sitioConSchedule);
    res.status(200).json(sitioConSchedule);
  } catch (error) {
    console.error('Error al obtener sitio por ID:', error);
    res.status(500).json({ message: error.message });
  }
});

// Actualizar un sitio
router.put('/:id', async (req, res) => {
  try {
    console.log('Actualizando sitio:', req.params.id);
    const { id } = req.params;
    const updateData = { ...req.body };

    // Extraer datos del schedule
    const scheduleData = {
      tipoFrecuencia: updateData.tipoFrecuencia,
      configuraciones: updateData.configuraciones,
      tags: updateData.tags,
      prioridad: updateData.prioridad,
      fechaInicio: updateData.fechaInicio,
      fechaFin: updateData.fechaFin,
      scrapingInmediato: updateData.scrapingInmediato
    };

    // Limpiar datos que no pertenecen al modelo Site
    delete updateData.tipoFrecuencia;
    delete updateData.configuraciones;
    delete updateData.tags;
    delete updateData.prioridad;
    delete updateData.fechaInicio;
    delete updateData.fechaFin;
    delete updateData.scrapingInmediato;
    delete updateData.ultimoError;
    delete updateData.bloqueo;

    // Actualizar datos del sitio
    updateData.activoParaScraping = updateData.tipoCarga === 'scraping';
    updateData.frecuenciaActualizacion = scheduleData.tipoFrecuencia;

    if (updateData.tipoCarga === 'manual') {
      delete updateData.frecuenciaActualizacion;
    }

    const updatedSite = await Site.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSite) {
      return res.status(404).json({ message: 'Sitio no encontrado' });
    }

    // Actualizar o crear schedule si es necesario
    if (updateData.tipoCarga === 'scraping' && scheduleData.configuraciones?.length > 0) {
      const schedule = await ScrapingSchedule.findOne({ sitioId: id });
      
      if (schedule) {
        // Actualizar schedule existente
        Object.assign(schedule, scheduleData);
        schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
        await schedule.save();
      } else {
        // Crear nuevo schedule
        const newSchedule = new ScrapingSchedule({
          sitioId: id,
          ...scheduleData,
          proximaEjecucion: new Date()
        });
        newSchedule.proximaEjecucion = newSchedule.calcularProximaEjecucion();
        await newSchedule.save();
      }
    } else if (updateData.tipoCarga === 'manual') {
      // Eliminar schedule si existe
      await ScrapingSchedule.findOneAndDelete({ sitioId: id });
    }

    // Actualizar el job de scraping
    await ScrapingService.updateJob(updatedSite);

    console.log('Sitio actualizado exitosamente:', updatedSite._id);
    res.status(200).json(updatedSite);
  } catch (error) {
    console.error('Error al actualizar sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
