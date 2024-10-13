const express = require('express');
const Projection = require('../models/projection.model');
const ScrapingService = require('../services/scraping.service');
const ImageScrapingService = require('../services/imagescraping.service');
const router = express.Router();
const { Parser } = require('json2csv');

// Crear una nueva proyección
router.post('/add', async (req, res) => {
  try {
    const newProjection = new Projection(req.body);
    const savedProjection = await newProjection.save();
    res.status(201).json(savedProjection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/proyecciones-actuales', async (req, res) => {
  try {
    const fechaActual = new Date();
    const projections = await Projection.find({
      habilitado: true,
      fechaHora: { $gte: fechaActual }
    }).sort({ fechaHora: 1 });
    res.status(200).json(projections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/proyecciones-anteriores', async (req, res) => {
  try {
    const fechaActual = new Date();
    const projections = await Projection.find({
      habilitado: true,
      fechaHora: { $lt: fechaActual }
    }).sort({ fechaHora: -1 });
    res.status(200).json(projections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cargar proyecciones desde imagen
router.post('/load-from-image', async (req, res) => {
  try {
    const { imageUrl, sitioId } = req.body;
    const projections = await ImageScrapingService.scrapeFromImage(imageUrl, sitioId);
    
    // Marcar las proyecciones como carga manual
    const projectionsWithManualFlag = projections.map(p => ({...p, cargaManual: true}));
    
    const savedProjections = await Projection.insertMany(projectionsWithManualFlag);
    res.status(201).json(savedProjections);
  } catch (error) {
    console.error('Error al cargar proyecciones desde imagen:', error);
    res.status(400).json({ message: error.message });
  }
});

// Obtener todas las proyecciones habilitadas
router.get('/', async (req, res) => {
  try {
    const projections = await Projection.find({ habilitado: true });
    res.status(200).json(projections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Actualizar una proyección
router.put('/:id', async (req, res) => {
  try {
    const updatedProjection = await Projection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedProjection) {
      return res.status(404).json({ message: 'Proyección no encontrada' });
    }
    res.status(200).json(updatedProjection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Deshabilitar una proyección (soft delete)
router.put('/disable/:id', async (req, res) => {
  try {
    const updatedProjection = await Projection.findByIdAndUpdate(
      req.params.id,
      { habilitado: false },
      { new: true }
    );
    if (!updatedProjection) {
      return res.status(404).json({ message: 'Proyección no encontrada' });
    }
    res.status(200).json(updatedProjection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Habilitar una proyección
router.put('/enable/:id', async (req, res) => {
  try {
    const updatedProjection = await Projection.findByIdAndUpdate(
      req.params.id,
      { habilitado: true },
      { new: true }
    );
    if (!updatedProjection) {
      return res.status(404).json({ message: 'Proyección no encontrada' });
    }
    res.status(200).json(updatedProjection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Ruta para exportar CSV
router.get('/exportar-csv', async (req, res) => {
  try {
    const { tipo } = req.query;
    let projections;
    const fechaActual = new Date();

    if (tipo === 'actual') {
      projections = await Projection.find({
        fechaHora: { $gte: fechaActual },
        habilitado: true
      }).populate('sitio', 'nombre');
    } else {
      projections = await Projection.find({ habilitado: true }).populate('sitio', 'nombre');
    }

    const fields = ['nombrePelicula', 'fechaHora', 'director', 'genero', 'duracion', 'sala', 'precio', 'nombreCine'];
    const opts = { fields };
    const parser = new Parser(opts);

    const csv = parser.parse(projections.map(p => ({
      ...p.toObject(),
      nombreCine: p.sitio.nombre,
      fechaHora: p.fechaHora.toLocaleString()
    })));

    res.header('Content-Type', 'text/csv');
    res.attachment(`cartelera_${tipo === 'actual' ? 'actual' : 'completa'}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error al exportar a CSV:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;