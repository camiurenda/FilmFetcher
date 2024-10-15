const express = require('express');
const router = express.Router();
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const ScrapingService = require('../services/scraping.service');

router.get('/', async (req, res) => {
  try {
    console.log('Iniciando obtención de estadísticas');

    const sitiosAgregados = await Site.countDocuments({ habilitado: true });
    console.log('Sitios agregados:', sitiosAgregados);

    const funcionesScrapeadas = await Projection.countDocuments({ habilitado: true });
    console.log('Funciones scrapeadas:', funcionesScrapeadas);
    
    // Obtener el próximo scraping programado
    const proximoScrapingInfo = await ScrapingService.obtenerProximoScraping();
    const proximoScraping = proximoScrapingInfo ? 
      `${proximoScrapingInfo.nombre} (${new Date(proximoScrapingInfo.fechaScraping).toLocaleString()})` : 
      'No programado';
    console.log('Próximo scraping:', proximoScraping);

    const ultimoScrapingExitoso = await ScrapingHistory.findOne({ estado: 'exitoso' })
      .sort({ fechaScraping: -1 })
      .populate('siteId', 'nombre');
    console.log('Último scraping exitoso:', ultimoScrapingExitoso);

    const ultimosScrapings = await ScrapingHistory.find({
      fechaScraping: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    console.log('Últimos scrapings:', ultimosScrapings.length);
    
    const tasaExitoScraping = ultimosScrapings.length > 0
      ? (ultimosScrapings.filter(s => s.estado === 'exitoso').length / ultimosScrapings.length * 100).toFixed(2)
      : 0;
    console.log('Tasa de éxito de scraping:', tasaExitoScraping);

    const sitioMasActivo = await Projection.aggregate([
      { $group: { _id: '$sitio', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    console.log('Sitio más activo:', sitioMasActivo);

    let sitioMasActivoNombre = 'N/A';
    if (sitioMasActivo.length > 0) {
      const sitio = await Site.findById(sitioMasActivo[0]._id);
      sitioMasActivoNombre = sitio ? sitio.nombre : 'N/A';
    }
    console.log('Nombre del sitio más activo:', sitioMasActivoNombre);

    res.json({
      sitiosAgregados,
      funcionesScrapeadas,
      proximoScraping,
      ultimoScrapingExitoso: ultimoScrapingExitoso
        ? `${ultimoScrapingExitoso.siteId.nombre} (${new Date(ultimoScrapingExitoso.fechaScraping).toLocaleString()})`
        : 'N/A',
      tasaExitoScraping,
      sitioMasActivo: sitioMasActivoNombre
    });

    console.log('Estadísticas enviadas con éxito');
  } catch (error) {
    console.error('Error detallado al obtener estadísticas:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas', 
      error: error.message,
      stack: error.stack 
    });
  }
});

module.exports = router;