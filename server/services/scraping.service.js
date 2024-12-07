const axios = require('axios');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const scheduleService = require('./schedule.service');
require('dotenv').config();

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || 'http://localhost:4000';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class ScrapingService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.peliculasDetallesCache = new Map();
    }

    extractBasicInfo(htmlContent) {
        const $ = cheerio.load(htmlContent);
        let extractedText = '';

        $('body').find('*').each((index, element) => {
            if ($(element).is('script, style, meta, link')) return;

            const text = $(element).clone().children().remove().end().text().trim();
            if (text) {
                extractedText += `${text}\n`;
            }

            if ($(element).is('img')) {
                const alt = $(element).attr('alt');
                const src = $(element).attr('src');
                if (alt || src) {
                    extractedText += `Imagen: ${alt || 'Sin descripción'} (${src})\n`;
                }
            }
        });

        return extractedText.trim();
    }

    async obtenerDetallesPelicula(nombrePelicula) {
        if (this.peliculasDetallesCache.has(nombrePelicula)) {
            return this.peliculasDetallesCache.get(nombrePelicula);
        }

        try {
            console.log(`🎬 [TMDB] Buscando detalles para: ${nombrePelicula}`);
            const searchResponse = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
                params: {
                    api_key: TMDB_API_KEY,
                    query: nombrePelicula,
                    language: 'es-ES'
                }
            });

            if (searchResponse.data.results.length > 0) {
                const peliculaId = searchResponse.data.results[0].id;
                const [detalles, creditos] = await Promise.all([
                    axios.get(`${TMDB_BASE_URL}/movie/${peliculaId}`, {
                        params: {
                            api_key: TMDB_API_KEY,
                            language: 'es-ES'
                        }
                    }),
                    axios.get(`${TMDB_BASE_URL}/movie/${peliculaId}/credits`, {
                        params: {
                            api_key: TMDB_API_KEY
                        }
                    })
                ]);

                const actoresPrincipales = creditos.data.cast
                    .slice(0, 3)
                    .map(actor => actor.name)
                    .join(', ');

                let paisOrigen = 'No especificado';
                let esPeliculaArgentina = false;

                if (detalles.data.production_countries && detalles.data.production_countries.length > 0) {
                    paisOrigen = detalles.data.production_countries[0].iso_3166_1;
                    esPeliculaArgentina = paisOrigen === 'AR';
                    console.log(`🎬 [TMDB] País de origen para ${nombrePelicula}: ${paisOrigen} (Argentina: ${esPeliculaArgentina ? 'Sí' : 'No'})`);
                }

                const detallesPelicula = {
                    titulo: detalles.data.title,
                    sinopsis: detalles.data.overview,
                    generos: detalles.data.genres.map(g => g.name).join(', '),
                    actores: actoresPrincipales,
                    duracion: detalles.data.runtime || 0,
                    puntuacion: detalles.data.vote_average.toFixed(1),
                    paisOrigen,
                    esPeliculaArgentina
                };

                this.peliculasDetallesCache.set(nombrePelicula, detallesPelicula);
                console.log(`✅ [TMDB] Detalles encontrados para: ${nombrePelicula}`);
                return detallesPelicula;
            }
            return null;
        } catch (error) {
            console.error(`❌ [TMDB] Error al obtener detalles:`, error);
            return null;
        }
    }

    async initializeJobs() {
        console.log('🚀 [FilmFetcher] Iniciando servicio de scraping...');
        try {
            await this.verificarServicioScraping();
            await scheduleService.inicializar();
            console.log('✅ [FilmFetcher] Servicio de scraping iniciado correctamente');
        } catch (error) {
            console.error('❌ [FilmFetcher] Error al iniciar servicio de scraping:', error);
            throw error;
        }
    }

    async verificarServicioScraping() {
        try {
            console.log('🔍 [FilmFetcher] Verificando microservicio en:', SCRAPING_SERVICE_URL);
            const response = await axios.get(`${SCRAPING_SERVICE_URL}/api/health`);
            console.log('✅ [FilmFetcher] Microservicio respondió:', response.data);
            return true;
        } catch (error) {
            console.error('❌ [FilmFetcher] Microservicio no disponible:', {
                error: error.message,
                url: SCRAPING_SERVICE_URL,
                config: error.config,
                response: error.response?.data
            });
            return false;
        }
    }

    async ejecutarScrapingInmediato(siteId) {
        try {
            console.log(`🔄 [FilmFetcher] Ejecutando scraping inmediato para sitio ${siteId}`);
            const site = await Site.findById(siteId);

            if (!site) {
                throw new Error('Sitio no encontrado');
            }

            console.log(`📌 [FilmFetcher] Iniciando scraping para ${site.nombre}`);
            const resultado = await this.scrapeSite(site);

            console.log(`✅ [FilmFetcher] Scraping inmediato completado para ${site.nombre}`);
            return resultado;
        } catch (error) {
            console.error('❌ [FilmFetcher] Error en scraping inmediato:', {
                siteId,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async scrapeSite(site) {
        console.log(`\n🎬 [FilmFetcher] INICIO SCRAPING: ${site.nombre}`);
        console.log(`📍 URL: ${site.url}`);
        let respuestaOpenAI = '';
        let causaFallo = '';

        try {
            console.log('🤖 [FilmFetcher] Solicitando scraping al microservicio...');
            const scrapeResponse = await axios.post(
                `${SCRAPING_SERVICE_URL}/api/scrape`,
                { url: site.url },
                {
                    timeout: 60000,
                    headers: {
                        'X-Source': 'FilmFetcher',
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📦 [FilmFetcher] Respuesta del microservicio:', {
                status: scrapeResponse.status,
                success: scrapeResponse.data?.success,
                dataLength: scrapeResponse.data?.data?.length || 0,
                error: scrapeResponse.data?.error
            });

            if (!scrapeResponse.data?.success) {
                causaFallo = scrapeResponse.data?.error || 'Respuesta del microservicio no exitosa';
                throw new Error(causaFallo);
            }

            if (!scrapeResponse.data?.data) {
                causaFallo = 'No se recibió contenido HTML del microservicio';
                throw new Error(causaFallo);
            }

            const htmlContent = scrapeResponse.data.data;
            console.log('📝 [FilmFetcher] HTML recibido, longitud:', htmlContent.length);

            // Usar cheerio para extraer texto limpio
            console.log('🧹 [FilmFetcher] Extrayendo texto con Cheerio...');
            const extractedText = this.extractBasicInfo(htmlContent);
            console.log('📄 [FilmFetcher] Texto extraído, longitud:', extractedText.length);

            console.log('🧠 [FilmFetcher] Procesando con OpenAI...');
            const openAIResponse = await this.openAIScrape(site, extractedText);
            respuestaOpenAI = JSON.stringify(openAIResponse);

            console.log('🎯 [FilmFetcher] Respuesta de OpenAI recibida');

            let proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
            if (!Array.isArray(proyecciones)) {
                causaFallo = 'La respuesta de OpenAI no contiene un array de proyecciones válido';
                throw new Error(causaFallo);
            }

            console.log('🎥 [FilmFetcher] Enriqueciendo datos con TMDB...');
            const projections = await this.processAIResponse(proyecciones, site);

            console.log(`🔍 [FilmFetcher] Verificando ${projections?.length || 0} proyecciones procesadas...`);
            if (!projections || !Array.isArray(projections)) {
                console.error('❌ [FilmFetcher] Error: projections no es un array válido:', projections);
                throw new Error('Las proyecciones procesadas no son válidas');
            }

            if (projections.length > 0) {
                console.log(`📥 [FilmFetcher] Insertando proyecciones en la base de datos...`);
                try {
                    await this.insertProjections(projections, site);
                    console.log(`✅ [FilmFetcher] ${projections.length} proyecciones guardadas para ${site.nombre}`);
                    await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length, respuestaOpenAI);
                    return { success: true, proyecciones: projections };
                } catch (dbError) {
                    console.error('❌ [FilmFetcher] Error al insertar proyecciones:', dbError);
                    throw dbError;
                }
            } else {
                causaFallo = 'No se encontraron proyecciones válidas';
                console.log('⚠️ [FilmFetcher]', causaFallo);
                await this.updateSiteAndHistory(site._id, 'exitoso', causaFallo, 0, respuestaOpenAI);
                return { success: true, proyecciones: [] };
            }

        } catch (error) {
            console.error('❌ [FilmFetcher] Error en scraping:', {
                sitio: site.nombre,
                error: error.message,
                stack: error.stack,
                causaFallo
            });
            await this.updateSiteAndHistory(site._id, 'fallido', error.message, 0, respuestaOpenAI, causaFallo);
            throw error;
        }
    }
     async processAIResponse(proyecciones, site) {
        console.log(`🎯 Procesando ${proyecciones.length} proyecciones para sitio ${site._id}`);
        const processedProjections = [];

        if (!site) {
            throw new Error('Se requiere el objeto site para procesar las proyecciones');
        }

        for (const p of proyecciones) {
            try {
                const nombrePelicula = p.nombre || p.Nombre;
                const fechaHora = new Date(p.fechaHora || p.FechaHora);

                if (!nombrePelicula || !fechaHora || isNaN(fechaHora.getTime())) {
                    console.log(`⚠️ Proyección inválida:`, {
                        nombre: nombrePelicula,
                        fecha: p.fechaHora || p.FechaHora
                    });
                    continue;
                }

                const detallesTMDB = await this.obtenerDetallesPelicula(nombrePelicula);

                let precio = 0;
                if (site.esGratis) {
                    precio = 0;
                } else {
                    precio = parseFloat(p.precio || p.Precio) || site.precioDefault || 0;
                }

                const proyeccion = {
                    nombrePelicula: detallesTMDB?.titulo || nombrePelicula,
                    fechaHora: fechaHora,
                    director: detallesTMDB?.director || p.director || p.Director || 'No especificado',
                    genero: detallesTMDB?.generos || p.genero || p.Genero || 'No especificado',
                    duracion: detallesTMDB?.duracion || parseInt(p.duracion || p.Duracion) || 0,
                    sala: p.sala || p.Sala || 'No especificada',
                    precio: precio,
                    sitio: site._id,
                    paisOrigen: detallesTMDB?.paisOrigen || 'No especificado',
                    esPeliculaArgentina: detallesTMDB?.esPeliculaArgentina || false
                };

                console.log(`✅ Proyección procesada: ${nombrePelicula} - ${fechaHora.toISOString()}`);
                processedProjections.push(proyeccion);
            } catch (error) {
                console.error(`❌ Error procesando proyección:`, error);
                continue;
            }
        }
        console.log(`📊 Total proyecciones procesadas: ${processedProjections.length}`);
        if (processedProjections.length === 0) {
            console.warn('⚠️ [FilmFetcher] No se procesaron proyecciones');
        }
        return processedProjections;
    }
    async openAIScrape(site, extractedInfo) {
        console.log(`[Scraping Service] Iniciando procesamiento OpenAI para ${site.nombre}`);
        const prompt = `Analiza este contenido HTML y extrae las proyecciones. DEVUELVE SOLO JSON con este formato:
        {
          "proyecciones": [
            {
              "nombre": "string",
              "fechaHora": "2024-01-01T00:00:00.000Z",
              "director": "string",
              "genero": "string",
              "duracion": 0,
              "sala": "string",
              "precio": 0
            }
          ]
        }
        
        Reglas:
        - Usa "No especificado" para texto faltante
        - Usa 0 para números faltantes
        - Asume que es el 2024 si no hay año
        - Crea entrada separada por cada horario
        - SIN texto adicional, SOLO JSON válido.
        - Todo el contenido en PROPERCASE. NO INSERTES TITULOS EN MAYUSCULAS.`;

        try {
            const fullPrompt = prompt + "\n\nContenido:\n" + extractedInfo;
            console.log('\n📤 [OpenAI] Enviando consulta a OpenAI:');
            console.log('='.repeat(50));
            console.log(fullPrompt);
            console.log('='.repeat(50));

            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto en extraer información de cine de texto HTML. Tu tarea es analizar el texto proporcionado y extraer información sobre las proyecciones de películas."
                    },
                    {
                        role: "user",
                        content: fullPrompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 8000
            });

            console.log('📘 [OpenAI] Respuesta completa:', JSON.stringify(response, null, 2));

            let content = response.choices[0]?.message?.content.trim() || "{}";
            content = content.replace(/```json\n?|\n?```/g, '').trim();

            return JSON.parse(content);
        } catch (error) {
            console.error('Error en OpenAI scrape:', error);
            throw new Error(`Error en procesamiento de OpenAI: ${error.message}`);
        }
    }

    


    async insertProjections(projections, site) {
        console.log(`📊 [DB] Iniciando inserción de ${projections.length} proyecciones para ${site.nombre}`);
        let insertadas = 0;
        let duplicadas = 0;
        let errores = 0;

        for (const projection of projections) {
            try {
                console.log(`🎬 [DB] Procesando: ${projection.nombrePelicula} - ${projection.fechaHora}`);
                const claveUnica = `${projection.nombrePelicula}-${projection.fechaHora.toISOString()}-${site._id}`;

                const doc = await Projection.findOneAndUpdate(
                    { claveUnica },
                    {
                        ...projection,
                        sitio: site._id,
                        nombreCine: site.nombre,
                        claveUnica,
                        habilitado: true,
                        fechaCreacion: new Date()
                    },
                    {
                        upsert: true,
                        new: true,
                        setDefaultsOnInsert: true,
                        runValidators: true
                    }
                );

                if (doc) {
                    console.log(`✅ [DB] Insertada/Actualizada: ${projection.nombrePelicula}`);
                    insertadas++;
                }
            } catch (error) {
                if (error.code === 11000) {
                    console.log(`⚠️ [DB] Duplicada: ${projection.nombrePelicula}`);
                    duplicadas++;
                } else {
                    console.error(`❌ [DB] Error al insertar ${projection.nombrePelicula}:`, error);
                    errores++;
                }
            }
        }

        console.log(`📈 [DB] Resumen de inserción:
            - Total procesadas: ${projections.length}
            - Insertadas/Actualizadas: ${insertadas}
            - Duplicadas: ${duplicadas}
            - Errores: ${errores}
        `);
    }

    async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones, respuestaOpenAI, causaFallo = '') {
        await Site.findByIdAndUpdate(siteId, {
            $set: { 'configuracionScraping.ultimoScrapingExitoso': new Date() }
        });

        await ScrapingHistory.create({
            siteId,
            estado,
            mensajeError,
            cantidadProyecciones,
            respuestaOpenAI,
            causaFallo,
            fechaScraping: new Date()
        });
    }

    async obtenerProximoScraping() {
        try {
            const estado = await scheduleService.obtenerEstadoSchedules();
            const proximo = estado.find(s => s.estado === 'activo');

            return proximo ? {
                nombre: proximo.sitio,
                fechaScraping: proximo.proximaEjecucion
            } : null;
        } catch (error) {
            console.error('Error al obtener próximo scraping:', error);
            return null;
        }
    }
}

module.exports = new ScrapingService();