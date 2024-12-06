const express = require('express');
const router = express.Router();
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const scheduleService = require('../services/schedule.service');

router.get('/', async (req, res) => {
    try {
        console.log('Iniciando obtención de estadísticas');

        const sitiosAgregados = await Site.countDocuments({ habilitado: true });
        console.log('Sitios agregados:', sitiosAgregados);

        const funcionesScrapeadas = await Projection.countDocuments({ habilitado: true });
        console.log('Funciones scrapeadas:', funcionesScrapeadas);

        const peliculasArgentinas = await Projection.countDocuments({
            habilitado: true,
            esPeliculaArgentina: true
        });
        console.log('Películas argentinas:', peliculasArgentinas);

        // Película con más funciones
        const peliculasAgrupadas = await Projection.aggregate([
            { $match: { habilitado: true } },
            {
                $group: {
                    _id: '$nombrePelicula',
                    totalFunciones: { $sum: 1 }
                }
            },
            { $sort: { totalFunciones: -1 } },
            { $limit: 1 }
        ]);

        const peliculaTopFunciones = peliculasAgrupadas.length > 0 
            ? `${peliculasAgrupadas[0]._id} (${peliculasAgrupadas[0].totalFunciones} funciones)`
            : 'No hay datos';

        console.log('Película con más funciones:', peliculaTopFunciones);


        // Obtener el próximo scraping programado
        const schedules = await scheduleService.obtenerEstadoSchedules();
        const ahora = new Date();
        
        // Filtrar y ordenar los schedules futuros
        const schedulesFuturos = schedules
            .filter(s => {
                const fechaEjecucion = new Date(s.proximaEjecucion);
                return fechaEjecucion > ahora && s.estado === 'activo';
            })
            .sort((a, b) => new Date(a.proximaEjecucion) - new Date(b.proximaEjecucion));

        const proximoScraping = schedulesFuturos.length > 0 ? 
            `${schedulesFuturos[0].sitio} (${new Date(schedulesFuturos[0].proximaEjecucion).toLocaleString()})` : 
            'No hay scraping programado';
            
        console.log('Próximo scraping:', proximoScraping);

        const ultimoScrapingExitoso = await ScrapingHistory.findOne(
            { estado: 'exitoso' }
        ).sort({ fechaScraping: -1 }).populate('siteId', 'nombre');
        console.log('Último scraping exitoso:', ultimoScrapingExitoso);

        const ultimosScrapings = await ScrapingHistory.find({
            fechaScraping: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        
        const tasaExitoScraping = ultimosScrapings.length > 0
            ? (ultimosScrapings.filter(s => s.estado === 'exitoso').length / ultimosScrapings.length * 100).toFixed(2)
            : 0;
        console.log('Tasa de éxito de scraping:', tasaExitoScraping);

        const sitioMasActivo = await Projection.aggregate([
            { $match: { habilitado: true } },
            { $group: { _id: '$sitio', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

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
            sitioMasActivo: sitioMasActivoNombre,
            peliculasArgentinas,
            peliculaTopFunciones
        });

        console.log('Estadísticas enviadas con éxito');
    } catch (error) {
        console.error('Error detallado al obtener estadísticas:', error);
        res.status(500).json({ 
            message: 'Error al obtener estadísticas', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;