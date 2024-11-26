const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');

require('dotenv').config();

// Configuración de URLs del servicio de scraping
const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || (() => {
    return process.env.NODE_ENV === "production"
        ? "https://filmfetcher-scraper.onrender.com"
        : "http://localhost:4000";
})();

// Configuración de timeouts y reintentos
const HEALTH_CHECK_TIMEOUT = 5000;
const SCRAPING_TIMEOUT = 60000;
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    fallbackToProduction: true
};

/**
 * Servicio principal de scraping
 * Maneja la extracción, procesamiento y almacenamiento de datos de carteleras
 */
class ScrapingService {
    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        this.scheduleManager = null;
        this.healthCheckPromise = null;
        this.lastHealthCheck = null;
        this.HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
    }

    /**
     * Inyecta el servicio de schedule para evitar dependencia circular
     * @param {Object} manager - Instancia del servicio de schedule
     */
    setScheduleManager(manager) {
        this.scheduleManager = manager;
    }

    /**
     * Verifica la disponibilidad del servicio de scraping
     * @returns {Promise<boolean>} Estado del servicio
     */
    async checkServiceAvailability() {
        // Si hay un health check reciente, usar ese resultado
        if (this.lastHealthCheck && Date.now() - this.lastHealthCheck.timestamp < this.HEALTH_CHECK_INTERVAL) {
            return this.lastHealthCheck.status;
        }

        // Si ya hay una promesa de health check en curso, esperar su resultado
        if (this.healthCheckPromise) {
            return this.healthCheckPromise;
        }

        let currentUrl = SCRAPING_SERVICE_URL;
        let attempts = 0;
        
        this.healthCheckPromise = (async () => {
            while (attempts < RETRY_CONFIG.maxRetries) {
                try {
                    console.log(`Intento ${attempts + 1}: Health check en ${currentUrl}`);
                    const healthCheck = await axios.get(`${currentUrl}/api/health`, {
                        timeout: HEALTH_CHECK_TIMEOUT,
                        headers: {
                            'Accept': 'application/json',
                            'X-Source': 'FilmFetcher'
                        }
                    });
                    
                    if (healthCheck.status === 200) {
                        console.log('Health check exitoso');
                        this.lastHealthCheck = {
                            timestamp: Date.now(),
                            status: true
                        };
                        return true;
                    }
                } catch (error) {
                    console.error(`Intento ${attempts + 1} fallido:`, error.message);
                    
                    if (process.env.NODE_ENV !== "production" && 
                        RETRY_CONFIG.fallbackToProduction && 
                        currentUrl.includes('localhost')) {
                        console.log('Cambiando a URL de producción...');
                        currentUrl = "https://filmfetcher-scraper.onrender.com";
                        continue;
                    }
                    
                    attempts++;
                    if (attempts < RETRY_CONFIG.maxRetries) {
                        const delay = Math.min(
                            RETRY_CONFIG.initialDelay * Math.pow(2, attempts),
                            RETRY_CONFIG.maxDelay
                        );
                        console.log(`Reintentando en ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            this.lastHealthCheck = {
                timestamp: Date.now(),
                status: false
            };
            return false;
        })();

        const result = await this.healthCheckPromise;
        this.healthCheckPromise = null;
        return result;
    }

    /**
     * Realiza el scraping de un sitio específico
     * @param {Object} site - Sitio a procesar
     */
    async ejecutarScrapingSitio(site) {
        return this.scrapeSite(site);
    }

    /**
     * Método privado que realiza el scraping
     * @private
     */
    async scrapeSite(site) {
        console.log(`==================== INICIO DE SCRAPING PARA ${site.nombre} ====================`);
       
    console.log(`Iniciando scraping para ${site.nombre} (${site.url}) en ${new Date().toISOString()}`);
    
    let respuestaOpenAI = '';
    let causaFallo = '';
    let currentAttempt = 1;

    while (currentAttempt <= RETRY_CONFIG.maxRetries) {
      try {
        // Verificar disponibilidad del servicio
        const isServiceAvailable = await this.checkServiceAvailability();
        if (!isServiceAvailable) {
          throw new Error('Servicio de scraping no disponible');
        }

        // Realizar scraping
        const scrapeResponse = await this.performScraping(site.url);
        if (!scrapeResponse.data) {
          throw new Error('No se recibieron datos del servicio de scraping');
        }

        // Procesar contenido con OpenAI
        const extractedInfo = this.extractBasicInfo(scrapeResponse.data);
        const openAIResponse = await this.openAIScrape(site, extractedInfo);
        respuestaOpenAI = JSON.stringify(openAIResponse);

        const proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
        if (!Array.isArray(proyecciones)) {
          throw new Error('Formato de respuesta OpenAI inválido');
        }

        // Procesar y guardar proyecciones
        const projections = this.processAIResponse(proyecciones, site._id);
        if (projections.length > 0) {
          await this.insertProjections(projections, site);
          await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length, respuestaOpenAI);
          console.log(`${projections.length} proyecciones procesadas correctamente para ${site.nombre}`);
          return;
        } else {
          console.log(`No se encontraron proyecciones en ${site.nombre}`);
          await this.updateSiteAndHistory(site._id, 'exitoso', 'Sin proyecciones encontradas', 0, respuestaOpenAI);
          return;
        }

      } catch (error) {
        console.error(`Error en intento ${currentAttempt}/${RETRY_CONFIG.maxRetries}:`, {
          sitio: site.nombre,
          error: error.message,
          stack: error.stack
        });
        
        if (currentAttempt < RETRY_CONFIG.maxRetries) {
          const delay = Math.min(
            RETRY_CONFIG.initialDelay * Math.pow(2, currentAttempt - 1),
            RETRY_CONFIG.maxDelay
          );
          console.log(`Reintentando en ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          currentAttempt++;
          continue;
        }

        causaFallo = `Fallaron todos los intentos: ${error.message}`;
        await this.updateSiteAndHistory(
          site._id, 
          'fallido',
          causaFallo,
          0,
          respuestaOpenAI,
          error.stack
        );
        break;
      }
    }

    console.log(`==================== FIN DE SCRAPING PARA ${site.nombre} ====================`);
  }

  /**
   * Realiza la petición de scraping al servicio externo
   */
  async performScraping(url) {
    try {
      console.log(`Iniciando scraping para URL: ${url}`);
      const response = await axios.post(
        `${SCRAPING_SERVICE_URL}/api/scrape`,
        { url },
        {
          timeout: SCRAPING_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'FilmFetcher'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error en performScraping:', error);
      throw new Error(`Error en scraping: ${error.message}`);
    }
  }

  /**
   * Extrae información básica del HTML utilizando Cheerio
   */
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

  /**
   * Procesa el contenido extraído utilizando OpenAI
   */
  async openAIScrape(site, extractedInfo) {
    const prompt = `Analiza el siguiente texto extraído de un sitio web de cine y extrae información sobre las proyecciones:

    ${extractedInfo}

    Devuelve un JSON con este formato:
    {
      "proyecciones": [
        {
          "nombre": "string",
          "fechaHora": "2024-01-01T00:00:00.000Z",
          "director": "string",
          "genero": "string",
          "duracion": number,
          "sala": "string",
          "precio": number
        }
      ]
    }
    
    Si no encuentras nada, devuelve un array vacío. Devuelve SOLO el JSON con los títulos en propercase.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un experto en extraer información de cine de texto HTML. Tu tarea es analizar el texto proporcionado y extraer información sobre las proyecciones de películas."
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

  /**
   * Procesa y normaliza la respuesta de OpenAI
   */
  processAIResponse(proyecciones, siteId) {
    if (!Array.isArray(proyecciones)) {
      console.error('processAIResponse recibió proyecciones no válidas:', proyecciones);
      return [];
    }

    const currentYear = new Date().getFullYear();
    return proyecciones
      .map(p => {
        try {
          let fechaHora = new Date(p.fechaHora || p.FechaHora);
          
          if (fechaHora < new Date()) {
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
          console.error('Error procesando proyección individual:', error);
          return null;
        }
      })
      .filter(p => p && p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
  }

  /**
   * Inserta o actualiza las proyecciones en la base de datos
   */
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

  /**
   * Actualiza el historial de scraping y el estado del sitio
   */
  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones, respuestaOpenAI, causaFallo = '') {
    try {
      await Site.findByIdAndUpdate(siteId, {
        $set: { 'configuracionScraping.ultimoScrapingExitoso': new Date() },
        $push: { 'configuracionScraping.errores': { fecha: new Date(), mensaje: mensajeError } }
      });

      await ScrapingHistory.create({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones,
        respuestaOpenAI,
        causaFallo
      });
    } catch (error) {
      console.error('Error al actualizar historial:', error);
      throw error;
    }
  }

  /**
   * Obtiene el próximo scraping programado
   */
  async obtenerProximoScraping() {
    try {
      const schedules = await this.getSchedule();
      if (!schedules || schedules.length === 0) {
        return null;
      }

      // El primer schedule es el próximo a ejecutar por ordenamiento
      const proximoSchedule = schedules[0];
      return {
        nombre: proximoSchedule.nombre,
        fechaScraping: proximoSchedule.proximaEjecucion
      };
    } catch (error) {
      console.error('Error al obtener próximo scraping:', error);
      return null;
    }
  }
}

module.exports = new ScrapingService();