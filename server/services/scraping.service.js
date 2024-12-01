const axios = require('axios');
const OpenAI = require('openai');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const scheduleService = require('./schedule.service');
require('dotenv').config();

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || 'http://localhost:4000';

class ScrapingService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    async initializeJobs() {
        console.log('Iniciando servicio de scraping...');
        try {
            await this.verificarServicioScraping();
            await scheduleService.inicializar();
            console.log('Servicio de scraping iniciado correctamente');
        } catch (error) {
            console.error('Error al iniciar servicio de scraping:', error);
            throw error;
        }
    }

    async verificarServicioScraping() {
        try {
            await axios.get(`${SCRAPING_SERVICE_URL}/api/health`);
            console.log('Servicio de scraping externo disponible');
            return true;
        } catch (error) {
            console.error('Servicio de scraping externo no disponible:', error.message);
            return false;
        }
    }

    async scrapeSite(site) {
        console.log(`==================== INICIO DE SCRAPING PARA ${site.nombre} ====================`);
        let respuestaOpenAI = '';
        let causaFallo = '';

        try {
            // Obtener HTML del servicio externo
            console.log(`Solicitando scraping de ${site.url} al servicio externo`);
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

            if (!scrapeResponse.data?.success || !scrapeResponse.data?.data) {
                throw new Error(scrapeResponse.data?.error || 'No se recibió contenido HTML del servicio');
            }

            const htmlContent = scrapeResponse.data.data;
            const openAIResponse = await this.openAIScrape(site, htmlContent);
            respuestaOpenAI = JSON.stringify(openAIResponse);

            let proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
            if (!Array.isArray(proyecciones)) {
                causaFallo = 'La respuesta de OpenAI no contiene un array de proyecciones válido';
                throw new Error(causaFallo);
            }

            const projections = this.processAIResponse(proyecciones, site._id);

            if (projections.length > 0) {
                await this.insertProjections(projections, site);
                console.log(`${projections.length} proyecciones procesadas para ${site.nombre}`);
                await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length, respuestaOpenAI);
            } else {
                causaFallo = 'No se encontraron proyecciones válidas';
                console.log(causaFallo);
                await this.updateSiteAndHistory(site._id, 'exitoso', causaFallo, 0, respuestaOpenAI);
            }

            return { success: true, proyecciones: projections };

        } catch (error) {
            console.error(`Error en scraping de ${site.nombre}:`, error);
            await this.updateSiteAndHistory(site._id, 'fallido', error.message, 0, respuestaOpenAI, causaFallo);
            throw error;
        }
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
      - Usa 2024 si no hay año
      - Crea entrada separada por cada horario
      - SIN texto adicional, SOLO JSON válido`;
  
      try {
        console.log(`[Scraping Service] Enviando solicitud a OpenAI (${extractedInfo.length} caracteres)`);
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un experto en extraer información de cine de texto HTML. Tu tarea es analizar el texto proporcionado y extraer información sobre las proyecciones de películas."
            },
            {
              role: "user",
              content: prompt + "\n\nContenido:\n" + extractedInfo
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
        return proyecciones.map(p => ({
            nombrePelicula: p.nombre || p.Nombre,
            fechaHora: new Date(p.fechaHora || p.FechaHora),
            director: p.director || p.Director || 'No especificado',
            genero: p.genero || p.Genero || 'No especificado',
            duracion: parseInt(p.duracion || p.Duracion) || 0,
            sala: p.sala || p.Sala || 'No especificada',
            precio: parseFloat(p.precio || p.Precio) || 0,
            sitio: siteId
        })).filter(p => p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
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