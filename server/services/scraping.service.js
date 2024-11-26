const axios = require('axios');
const OpenAI = require('openai');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const ScrapingSchedule = require('../models/scrapingSchedule.model');

require('dotenv').config();

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || "http://localhost:4000";
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    fallbackToProduction: true
};

class ScrapingService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.scheduleManager = null;
        this.serviceAvailable = null;
        this.lastHealthCheck = 0;
        this.healthCheckPromise = null;
    }

    setScheduleManager(manager) {
        this.scheduleManager = manager;
        console.log('ScheduleManager establecido en ScrapingService');
    }

    async checkServiceAvailability() {
        const now = Date.now();
        if (this.serviceAvailable !== null && now - this.lastHealthCheck < 300000) {
            return this.serviceAvailable;
        }

        if (this.healthCheckPromise) {
            return this.healthCheckPromise;
        }

        this.healthCheckPromise = (async () => {
            try {
                const response = await axios.get(`${SCRAPING_SERVICE_URL}/api/health`, {
                    timeout: 5000,
                    headers: {
                        'Accept': 'application/json',
                        'X-Source': 'FilmFetcher'
                    }
                });
                
                this.serviceAvailable = response.status === 200;
                this.lastHealthCheck = now;
                return this.serviceAvailable;
            } catch (error) {
                console.error('Error en health check:', error.message);
                this.serviceAvailable = false;
                this.lastHealthCheck = now;
                return false;
            } finally {
                this.healthCheckPromise = null;
            }
        })();

        return this.healthCheckPromise;
    }

    async performScraping(url) {
        try {
            console.log(`Iniciando scraping para URL: ${url}`);
            const response = await axios.post(
                `${SCRAPING_SERVICE_URL}/api/scrape`,
                { url },
                {
                    timeout: 60000,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Source': 'FilmFetcher'
                    }
                }
            );

            if (!response.data || response.data.status === 'error') {
                throw new Error(response.data?.error || 'Error en respuesta del servicio de scraping');
            }

            return response.data;
        } catch (error) {
            console.error('Error en performScraping:', error.message);
            throw new Error(`Error en scraping: ${error.message}`);
        }
    }

    async scrapeSite(site) {
        console.log(`Iniciando scraping para sitio: ${site.nombre}`);
        let respuestaOpenAI = '';
        let causaFallo = '';
        let currentAttempt = 1;

        while (currentAttempt <= RETRY_CONFIG.maxRetries) {
            try {
                if (!await this.checkServiceAvailability()) {
                    throw new Error('Servicio de scraping no disponible');
                }

                const scrapeResponse = await this.performScraping(site.url);
                const htmlContent = scrapeResponse.data;
                
                const extractedInfo = this.extractBasicInfo(htmlContent);
                const openAIResponse = await this.openAIScrape(extractedInfo);
                respuestaOpenAI = JSON.stringify(openAIResponse);

                const proyecciones = openAIResponse.proyecciones || [];
                if (Array.isArray(proyecciones) && proyecciones.length > 0) {
                    const projections = this.processAIResponse(proyecciones, site._id);
                    await this.insertProjections(projections, site);
                    await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length, respuestaOpenAI);
                    console.log(`Scraping exitoso para ${site.nombre}: ${projections.length} proyecciones`);
                    return;
                } else {
                    console.log(`No se encontraron proyecciones en ${site.nombre}`);
                    await this.updateSiteAndHistory(site._id, 'exitoso', 'Sin proyecciones encontradas', 0, respuestaOpenAI);
                    return;
                }
            } catch (error) {
                console.error(`Error en intento ${currentAttempt}:`, error.message);
                
                if (currentAttempt < RETRY_CONFIG.maxRetries) {
                    const delay = Math.min(
                        RETRY_CONFIG.initialDelay * Math.pow(2, currentAttempt - 1),
                        RETRY_CONFIG.maxDelay
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    currentAttempt++;
                } else {
                    causaFallo = `Fallaron todos los intentos: ${error.message}`;
                    await this.updateSiteAndHistory(site._id, 'fallido', causaFallo, 0, respuestaOpenAI);
                    throw error;
                }
            }
        }
    }

    async openAIScrape(extractedInfo) {
        const prompt = `Analiza el siguiente texto y extrae información sobre proyecciones cinematográficas:

        ${extractedInfo}

        Devuelve un JSON con este formato:
        {
          "proyecciones": [
            {
              "nombre": "string",
              "fechaHora": "string (ISO)",
              "director": "string",
              "genero": "string",
              "duracion": number,
              "sala": "string",
              "precio": number
            }
          ]
        }
        Si no hay proyecciones, devuelve un array vacío. Asume año actual (2024) si no se especifica.`;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto en extraer información estructurada de carteleras de cine."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2,
                max_tokens: 8000
            });

            let content = response.choices[0]?.message?.content.trim() || "{}";
            content = content.replace(/```json\n?|\n?```/g, '').trim();

            return JSON.parse(content);
        } catch (error) {
            console.error('Error en OpenAI scrape:', error);
            throw new Error(`Error en procesamiento de OpenAI: ${error.message}`);
        }
    }

    processAIResponse(proyecciones, siteId) {
        const currentYear = new Date().getFullYear();
        return proyecciones
            .map(p => {
                try {
                    let fechaHora = new Date(p.fechaHora || p.FechaHora);
                    if (isNaN(fechaHora.getTime())) return null;

                    if (fechaHora.getFullYear() < currentYear) {
                        fechaHora.setFullYear(currentYear);
                    }

                    return {
                        nombrePelicula: p.nombre || p.Nombre,
                        fechaHora,
                        director: p.director || p.Director || 'No especificado',
                        genero: p.genero || p.Genero || 'No especificado',
                        duracion: parseInt(p.duracion || p.Duracion) || 0,
                        sala: p.sala || p.Sala || 'No especificada',
                        precio: parseFloat(p.precio || p.Precio) || 0,
                        sitio: siteId
                    };
                } catch (error) {
                    console.error('Error procesando proyección:', error);
                    return null;
                }
            })
            .filter(p => p && p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
    }

    async insertProjections(projections, site) {
        for (const projection of projections) {
            try {
                const claveUnica = `${projection.nombrePelicula}-${projection.fechaHora.toISOString()}-${site._id}`;
                await Projection.findOneAndUpdate(
                    { claveUnica },
                    {
                        ...projection,
                        sitio: site._id,
                        nombreCine: site.nombre,
                        claveUnica
                    },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
            } catch (error) {
                if (error.code === 11000) {
                    console.log(`Proyección duplicada ignorada: ${projection.nombrePelicula}`);
                } else {
                    throw error;
                }
            }
        }
    }

    async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones, respuestaOpenAI) {
        try {
            await Site.findByIdAndUpdate(siteId, {
                $set: { 'ultimoScrapingExitoso': estado === 'exitoso' ? new Date() : undefined }
            });

            await ScrapingHistory.create({
                siteId,
                estado,
                mensajeError,
                cantidadProyecciones,
                respuestaOpenAI,
                fechaScraping: new Date()
            });
        } catch (error) {
            console.error('Error actualizando historial:', error);
        }
    }

    extractBasicInfo(htmlContent) {
        const cheerio = require('cheerio');
        const $ = cheerio.load(htmlContent);
        let extractedText = '';

        $('body').find('*').each((_, element) => {
            const $element = $(element);
            if ($element.is('script, style, meta, link')) return;

            const text = $element.clone().children().remove().end().text().trim();
            if (text) extractedText += `${text}\n`;

            if ($element.is('img')) {
                const alt = $element.attr('alt');
                const src = $element.attr('src');
                if (alt || src) {
                    extractedText += `Imagen: ${alt || 'Sin descripción'} (${src})\n`;
                }
            }
        });

        return extractedText.trim();
    }

    async obtenerProximoScraping() {
        try {
            const schedules = await ScrapingSchedule.find({ activo: true })
                .populate('sitioId')
                .sort({ proximaEjecucion: 1 })
                .limit(1);

            if (!schedules || schedules.length === 0) return null;

            const proximoSchedule = schedules[0];
            return {
                nombre: proximoSchedule.sitioId?.nombre || 'Sitio desconocido',
                fechaScraping: proximoSchedule.proximaEjecucion
            };
        } catch (error) {
            console.error('Error obteniendo próximo scraping:', error);
            return null;
        }
    }
}

module.exports = new ScrapingService();