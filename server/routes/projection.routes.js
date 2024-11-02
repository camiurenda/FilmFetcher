const express = require('express');
const Projection = require('../models/projection.model');
const ScrapingService = require('../services/scraping.service');
const ImageScrapingService = require('../services/imagescraping.service');
const PDFScrapingService = require('../services/pdfscraping.service');
const Site = require('../models/site.model');
const router = express.Router();
const { Parser } = require('json2csv');

// Crear una nueva proyección
router.post('/add', async (req, res) => {
  try {
    const { nombrePelicula, fechaHora, sitio, director, genero, duracion, sala, precio } = req.body;

    // Validar campos requeridos
    if (!nombrePelicula || !fechaHora || !sitio) {
      return res.status(400).json({ message: 'Faltan campos requeridos: nombrePelicula, fechaHora y sitio son obligatorios' });
    }

    // Obtener el nombre del cine
    let siteInfo;
    try {
      siteInfo = await Site.findById(sitio);
      if (!siteInfo) {
        return res.status(404).json({ message: 'Sitio no encontrado' });
      }
    } catch (error) {
      console.error('Error al buscar el sitio:', error);
      return res.status(500).json({ message: 'Error al buscar el sitio en la base de datos' });
    }

    // Generar claveUnica
    const claveUnica = `${nombrePelicula}-${new Date(fechaHora).toISOString()}-${sitio}`;

    const newProjection = new Projection({
      nombrePelicula,
      fechaHora,
      sitio,
      director,
      genero,
      duracion,
      sala,
      precio,
      cargaManual: true,
      nombreCine: siteInfo.nombre,
      claveUnica
    });

    const savedProjection = await newProjection.save();
    res.status(201).json(savedProjection);
  } catch (error) {
    console.error('Error al crear la proyección:', error);
    res.status(500).json({ message: 'Error interno del servidor al crear la proyección' });
  }
});

router.get('/proyecciones-actuales', async (req, res) => {
  try {
    const fechaActual = new Date();
    const projections = await Projection.find({
      habilitado: true,
      fechaHora: { $gte: fechaActual }
    })
    .sort({ fechaHora: 1 });
    res.status(200).json(projections);
  } catch (error) {
    console.error('Error al obtener proyecciones:', error);
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


router.post('/load-from-file', async (req, res) => {
  try {
    const { fileUrl, sitioId, fileType } = req.body;
    let projections;

    const site = await Site.findById(sitioId);
    if (!site) {
      return res.status(404).json({ message: 'Sitio no encontrado' });
    }

    if (fileType === 'image') {
      projections = await ImageScrapingService.scrapeFromImage(fileUrl, sitioId);
    } else if (fileType === 'pdf') {
      projections = await PDFScrapingService.scrapeFromPDF(fileUrl, sitioId);
    } else {
      return res.status(400).json({ message: 'Tipo de archivo no soportado' });
    }
    
    if (projections.length === 0) {
      return res.status(404).json({ message: 'No se encontraron proyecciones en el archivo' });
    }

    res.status(200).json(projections);
  } catch (error) {
    console.error('Error al cargar proyecciones desde archivo:', error);
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
      nombreCine: p.nombreCine || (p.sitio && p.sitio.nombre) || 'No especificado',
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