const express = require('express');
const Site = require('../models/site.model');
const ScrapingService = require('../services/scraping.service');
const ScrapingHistory = require('../models/scrapingHistory.model');
const router = express.Router();


router.post('/add', async (req, res) => {
  try {
    console.log('Datos recibidos en el servidor:', req.body); // Agregamos este log

    const { nombre, url, direccion, tipo, tipoCarga, frecuenciaActualizacion, usuarioCreador } = req.body;

    // Validación básica
    if (!nombre || !url || !tipoCarga || !usuarioCreador) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    // Validación adicional para tipoCarga 'scraping'
    if (tipoCarga === 'scraping' && !frecuenciaActualizacion) {
      return res.status(400).json({ message: 'La frecuencia de actualización es requerida para sitios de scraping' });
    }

    const newSite = new Site({
      nombre,
      url,
      direccion,
      tipo,
      tipoCarga,
      frecuenciaActualizacion,
      usuarioCreador,
      habilitado: true,
      activoParaScraping: tipoCarga === 'scraping'
    });

    const savedSite = await newSite.save();
    res.status(201).json(savedSite);
  } catch (error) {
    console.error('Error al guardar el sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

router.get('/manual', async (req, res) => {
  try {
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
    const schedule = await ScrapingService.getSchedule();
    res.status(200).json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Obtener el historial de scraping
router.get('/scraping-history', async (req, res) => {
  try {
    const history = await ScrapingHistory.find().populate('siteId', 'nombre');
    res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching scraping history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Obtener todos los sitios habilitados
router.get('/', async (req, res) => {
  try {
    const sites = await Site.find({ habilitado: true });
    // Asegurarse de que siempre devolvamos un array
    res.status(200).json(sites || []);
  } catch (error) {
    console.error('Error al obtener sitios:', error);
    res.status(500).json({ message: error.message });
  }
});

// Actualizar un sitio
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    updateData.activoParaScraping = updateData.tipoCarga === 'scraping';

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

    if (updatedSite.activoParaScraping) {
      ScrapingService.updateJob(updatedSite);
    } else {
      ScrapingService.removeJob(updatedSite._id);
    }

    res.status(200).json(updatedSite);
  } catch (error) {
    console.error('Error al actualizar el sitio:', error);
    res.status(400).json({ message: error.message });
  }
});

// Deshabilitar un sitio (soft delete)
router.put('/disable/:id', async (req, res) => {
  try {
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
    res.status(400).json({ message: error.message });
  }
});

// Habilitar un sitio
router.put('/enable/:id', async (req, res) => {
  try {
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
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;