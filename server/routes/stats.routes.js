const express = require('express');
const router = express.Router();
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const scheduleService = require('../services/schedule.service');
const moment = require('moment-timezone');

router.get('/', async (req, res) => {
    try {
        console.log('🔍 [Stats] Iniciando obtención de estadísticas');
        const timezone = 'America/Argentina/Buenos_Aires';

        const sitiosAgregados = await Site.countDocuments({ habilitado: true });
        console.log('📊 [Stats] Sitios agregados:', sitiosAgregados);

        const funcionesScrapeadas = await Projection.countDocuments({ habilitado: true });
        console.log('📊 [Stats] Funciones scrapeadas:', funcionesScrapeadas);

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

        console.log('📊 [Stats] Película con más funciones:', peliculaTopFunciones);

        // Obtener el próximo scraping programado
        const schedules = await scheduleService.obtenerEstadoSchedules();
        const ahora = moment().tz(timezone);
        
        // Filtrar y ordenar los schedules futuros
        const schedulesFuturos = schedules
            .filter(s => {
                const fechaEjecucion = moment(s.proximaEjecucion).tz(timezone);
                return fechaEjecucion.isAfter(ahora) && s.estado === 'activo';
            })
            .sort((a, b) => moment(a.proximaEjecucion).tz(timezone) - moment(b.proximaEjecucion).tz(timezone));

        const proximoScraping = schedulesFuturos.length > 0 ? 
            `${schedulesFuturos[0].sitio} (${moment(schedulesFuturos[0].proximaEjecucion).tz(timezone).format('DD/MM/YYYY, HH:mm:ss')})` : 
            'No hay scraping programado';
            
        console.log('📅 [Stats] Próximo scraping:', proximoScraping);

        const ultimoScrapingExitoso = await ScrapingHistory.findOne(
            { estado: 'exitoso' }
        ).sort({ fechaScraping: -1 }).populate('siteId', 'nombre');

        console.log('📅 [Stats] Último scraping exitoso:', ultimoScrapingExitoso);

        const ultimosScrapings = await ScrapingHistory.find({
            fechaScraping: { $gte: moment().subtract(7, 'days').toDate() }
        });
        
        const tasaExitoScraping = ultimosScrapings.length > 0
            ? (ultimosScrapings.filter(s => s.estado === 'exitoso').length / ultimosScrapings.length * 100).toFixed(2)
            : 0;

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

        // Formatear fechas en zona horaria correcta
        const formatearFecha = (fecha) => {
            if (!fecha) return null;
            return moment(fecha).tz(timezone).format();
        };

        const response = {
            sitiosAgregados,
            funcionesScrapeadas,
            peliculasArgentinas,
            peliculaTopFunciones,
            proximoScraping: formatearFecha(schedulesFuturos[0]?.proximaEjecucion),
            ultimoScrapingExitoso: formatearFecha(ultimoScrapingExitoso?.fechaScraping),
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