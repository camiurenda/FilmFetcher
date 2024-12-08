const express = require('express');
const router = express.Router();
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const moment = require('moment-timezone');
const scheduleService = require('../services/schedule.service');

router.get('/', async (req, res) => {
    try {
        console.log('🔍 [Stats] Iniciando obtención de estadísticas');
        const timezone = 'America/Argentina/Buenos_Aires';

        // Sitios agregados
        const sitiosAgregados = await Site.countDocuments({ habilitado: true });
        console.log('📊 [Stats] Sitios agregados:', sitiosAgregados);

        // Funciones scrapeadas
        const funcionesScrapeadas = await Projection.countDocuments({ habilitado: true });
        console.log('📊 [Stats] Funciones scrapeadas:', funcionesScrapeadas);

        // Películas argentinas
        const peliculasArgentinas = await Projection.countDocuments({
            habilitado: true,
            esPeliculaArgentina: true
        });
        console.log('📊 [Stats] Películas argentinas:', peliculasArgentinas);

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

        // Próximo scraping
        let proximoScraping = null;
        try {
            const schedules = await scheduleService.obtenerEstadoSchedules();
            const ahora = moment();
            
            if (Array.isArray(schedules) && schedules.length > 0) {
                const schedulesFuturos = schedules
                    .filter(s => s.proximaEjecucion && moment(s.proximaEjecucion).isAfter(ahora) && s.estado === 'activo')
                    .sort((a, b) => moment(a.proximaEjecucion) - moment(b.proximaEjecucion));

                if (schedulesFuturos.length > 0) {
                    proximoScraping = {
                        fecha: moment(schedulesFuturos[0].proximaEjecucion).format(),
                        sitio: schedulesFuturos[0].sitio || 'Desconocido'
                    };
                }
            }
        } catch (scheduleError) {
            console.error('Error al obtener próximo scraping:', scheduleError);
        }

        // Último scraping exitoso
        let ultimoScrapingExitoso = null;
        try {
            const ultimoScraping = await ScrapingHistory.findOne(
                { estado: 'exitoso' }
            ).sort({ fechaScraping: -1 }).populate('siteId');

            if (ultimoScraping) {
                ultimoScrapingExitoso = {
                    fecha: moment(ultimoScraping.fechaScraping).format(),
                    sitio: ultimoScraping.siteId?.nombre || 'Desconocido'
                };
            }
        } catch (historyError) {
            console.error('Error al obtener último scraping:', historyError);
        }

        // Tasa de éxito
        const ultimosScrapings = await ScrapingHistory.find({
            fechaScraping: { $gte: moment().subtract(7, 'days').toDate() }
        });
        
        const tasaExitoScraping = ultimosScrapings.length > 0
            ? (ultimosScrapings.filter(s => s.estado === 'exitoso').length / ultimosScrapings.length * 100).toFixed(2)
            : 0;

        // Sitio más activo
        let sitioMasActivoNombre = 'No disponible';
        try {
            const sitioMasActivo = await Projection.aggregate([
                { $match: { habilitado: true } },
                { $group: { _id: '$sitio', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 1 }
            ]);

            if (sitioMasActivo.length > 0) {
                const sitio = await Site.findById(sitioMasActivo[0]._id);
                if (sitio) {
                    sitioMasActivoNombre = sitio.nombre;
                }
            }
        } catch (sitioError) {
            console.error('Error al obtener sitio más activo:', sitioError);
        }

        const response = {
            sitiosAgregados,
            funcionesScrapeadas,
            peliculasArgentinas,
            peliculaTopFunciones,
            proximoScraping,
            ultimoScrapingExitoso,
            tasaExitoScraping,
            sitioMasActivo: sitioMasActivoNombre
        };

        console.log('✅ [Stats] Datos preparados:', response);
        res.json(response);

    } catch (error) {
        console.error('❌ [Stats] Error:', error);
        res.status(500).json({ 
            message: 'Error al obtener estadísticas', 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;