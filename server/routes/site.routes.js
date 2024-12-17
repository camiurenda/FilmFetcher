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

// Ejecutar scraping inmediato
router.post('/scrape/:id', async (req, res) => {
  try {
    console.log('Iniciando scraping inmediato para sitio:', req.params.id);
    const result = await ScrapingService.ejecutarScrapingInmediato(req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Error en scraping inmediato:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error al ejecutar scraping inmediato'
    });
  }
});

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
          await ScrapingSchedule.updateMany(
              { sitioId: savedSite._id },
              { activo: false }
          );

          const newSchedule = new ScrapingSchedule({
              sitioId: savedSite._id,
              tipoFrecuencia: tipoFrecuencia,
              configuraciones: configuraciones.map(config => ({
                  hora: config.hora,
                  diasSemana: config.diasSemana || [],
                  diasMes: config.diasMes || [],
                  descripcion: config.descripcion || ''
              })),
              tags,
              prioridad,
              fechaInicio,
              fechaFin,
              proximaEjecucion: new Date()
          });

          console.log('Creando nuevo schedule con configuración:', {
              tipoFrecuencia,
              configuraciones: newSchedule.configuraciones
          });

          await newSchedule.save();
      }

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

// Actualizar un sitio
router.put('/:id', async (req, res) => {
  try {
    console.log('Actualizando sitio:', req.params.id);
    console.log('Datos recibidos:', req.body);
    
    const { id } = req.params;
    const updateData = { ...req.body };

    // Extraer datos del schedule
    const scheduleData = {
      tipoFrecuencia: updateData.tipoFrecuencia,
      configuraciones: updateData.configuraciones?.map(config => ({
        hora: config.hora,
        diasSemana: config.diasSemana || [],
        diasMes: config.diasMes || [],
        descripcion: config.descripcion || 'Configuración actualizada del sitio'
      })) || [],
      tags: updateData.tags,
      prioridad: updateData.prioridad,
      fechaInicio: updateData.fechaInicio,
      fechaFin: updateData.fechaFin
    };

    console.log('Datos del schedule:', scheduleData);

    // Actualizar datos del sitio
    updateData.activoParaScraping = updateData.tipoCarga === 'scraping';
    // Mantener la frecuencia de actualización original
    updateData.frecuenciaActualizacion = updateData.tipoFrecuencia;

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

    const updatedSite = await Site.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSite) {
      return res.status(404).json({ message: 'Sitio no encontrado' });
    }

    // Actualizar o crear schedule si es necesario
    if (updateData.tipoCarga === 'scraping') {
      // Obtener schedule existente
      let schedule = await ScrapingSchedule.findOne({ sitioId: id });
      
      if (schedule) {
        // Actualizar schedule existente
        schedule.tipoFrecuencia = scheduleData.tipoFrecuencia;
        schedule.configuraciones = scheduleData.configuraciones;
        schedule.activo = true;
        await schedule.save();
        console.log('Schedule actualizado:', {
          id: schedule._id,
          configuraciones: schedule.configuraciones
        });
      } else {
        // Crear nuevo schedule
        schedule = new ScrapingSchedule({
          sitioId: id,
          tipoFrecuencia: scheduleData.tipoFrecuencia,
          configuraciones: scheduleData.configuraciones,
          activo: true,
          proximaEjecucion: new Date()
        });
        await schedule.save();
        console.log('Nuevo schedule creado:', {
          id: schedule._id,
          configuraciones: schedule.configuraciones
        });
      }
    }

    res.status(200).json(updatedSite);
  } catch (error) {
    console.error('Error al actualizar sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
