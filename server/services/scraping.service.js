const axios = require('axios');
const cheerio = require('cheerio');
const OpenAI = require('openai');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
const ScrapingSchedule = require('../models/scrapingSchedule.model');

require('dotenv').config();

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || (() => {
  return process.env.NODE_ENV === "production"
    ? "http://localhost:4000"
    : "https://filmfetcher-scraper.onrender.com";
})();

const CONFIG = {
  HEALTH_CHECK_TIMEOUT: 5000,
  SCRAPING_TIMEOUT: 60000,
  BATCH_SIZE: 1,
  SERVICE_CHECK_INTERVAL: 300000,
  RETRY_DELAY: 600000,
  SCHEDULE_CHECK_INTERVAL: 30000,
  EXECUTION_THRESHOLD: 10000
};

class ScrapingService {
  constructor() {
    this.jobs = {};
    this.lastRunTimes = {};
    this.nextScheduledRuns = {};
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.scrapingQueue = [];
    this.isProcessingQueue = false;
    this.serviceAvailable = false;
    this.scheduledTimers = new Map();
  }

  async initializeJobs() {
    console.log('Iniciando inicialización de trabajos de scraping...');
    try {
      // Clear existing timers
      this.scheduledTimers.forEach(timer => clearTimeout(timer));
      this.scheduledTimers.clear();
      this.scrapingQueue = [];

      const sites = await Site.find({ activoParaScraping: true });
      console.log(`Encontrados ${sites.length} sitios activos para scraping`);
      
      sites.forEach(site => this.scheduleJob(site));
      
      this.startServiceCheck();
      this.startScheduleCheck();
      console.log(`Inicializados ${sites.length} trabajos de scraping. Esperando disponibilidad del servicio.`);
    } catch (error) {
      console.error('Error al inicializar jobs:', error);
    }
  }

  startScheduleCheck() {
    // Clear any existing interval
    if (this.scheduleCheckInterval) {
      clearInterval(this.scheduleCheckInterval);
    }

    // Check for upcoming schedules periodically
    this.scheduleCheckInterval = setInterval(async () => {
      if (!this.serviceAvailable) return;

      try {
        const now = new Date();
        const upcoming = await ScrapingSchedule.find({
          activo: true,
          proximaEjecucion: {
            $gt: now,
            $lt: new Date(now.getTime() + CONFIG.SCHEDULE_CHECK_INTERVAL)
          }
        }).populate('sitioId');

        upcoming.forEach(schedule => {
          if (!schedule.sitioId) return;

          const timerId = schedule._id.toString();
          if (this.scheduledTimers.has(timerId)) return;

          const timeUntilExecution = schedule.proximaEjecucion.getTime() - now.getTime();
          if (timeUntilExecution <= 0) return;

          // Schedule the execution
          const timer = setTimeout(async () => {
            console.log(`Ejecutando scraping programado para ${schedule.sitioId.nombre}`);
            await this.processSingleSite(schedule.sitioId);
            this.scheduledTimers.delete(timerId);
          }, timeUntilExecution);

          this.scheduledTimers.set(timerId, timer);
          console.log(`Programado scraping para ${schedule.sitioId.nombre} en ${timeUntilExecution}ms`);
        });
      } catch (error) {
        console.error('Error al verificar próximos schedules:', error);
      }
    }, CONFIG.SCHEDULE_CHECK_INTERVAL);
  }

  startServiceCheck() {
    this.checkServiceAvailability().then(available => {
      this.serviceAvailable = available;
    });

    setInterval(async () => {
      this.serviceAvailable = await this.checkServiceAvailability();
    }, CONFIG.SERVICE_CHECK_INTERVAL);
  }

  async checkServiceAvailability() {
    console.log('Verificando disponibilidad del servicio de scraping...');
    try {
      const response = await axios.get(`${SCRAPING_SERVICE_URL}/api/health`, {
        timeout: CONFIG.HEALTH_CHECK_TIMEOUT,
        headers: {
          'X-Source': 'FilmFetcher'
        }
      });
      const available = response.status === 200;
      console.log(`Servicio de scraping ${available ? 'disponible' : 'no disponible'}`);
      return available;
    } catch (error) {
      console.log('Servicio de scraping no disponible:', error.message);
      return false;
    }
  }

  async processSingleSite(site) {
    if (!this.serviceAvailable) return;

    console.log(`[Scraping Service] Iniciando procesamiento para sitio: ${site.nombre} (${site.url})`);
    try {
      console.log(`[Scraping Service] Enviando petición al microservicio para ${site.url}`);
      // Usar el microservicio Puppeteer para el scraping
      const scrapeResponse = await axios.post(
        `${SCRAPING_SERVICE_URL}/api/scrape`,
        { url: site.url },
        { 
          timeout: CONFIG.SCRAPING_TIMEOUT,
          headers: {
            'X-Source': 'FilmFetcher',
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`[Scraping Service] Respuesta recibida del microservicio para ${site.nombre}:`, {
        success: scrapeResponse.data?.success,
        status: scrapeResponse.data?.status,
        htmlLength: scrapeResponse.data?.data?.length || 0
      });

      if (!scrapeResponse.data?.success || !scrapeResponse.data?.data) {
        throw new Error(scrapeResponse.data?.error || 'No se recibió contenido HTML del microservicio');
      }

      const htmlContent = scrapeResponse.data.data;
      console.log(`[Scraping Service] Extrayendo información básica del HTML (${htmlContent.length} caracteres)`);
      const extractedInfo = this.extractBasicInfo(htmlContent);
      console.log(`[Scraping Service] Información extraída (${extractedInfo.length} caracteres). Enviando a OpenAI`);

      const openAIResponse = await this.openAIScrape(site, extractedInfo);
      console.log(`[Scraping Service] Respuesta recibida de OpenAI:`, {
        proyeccionesCount: openAIResponse.proyecciones?.length || openAIResponse.Proyecciones?.length || 0
      });
      
      let proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
      if (!Array.isArray(proyecciones)) {
        throw new Error('Formato de respuesta OpenAI inválido');
      }

      console.log(`[Scraping Service] Procesando ${proyecciones.length} proyecciones de OpenAI`);
      const projections = this.processAIResponse(proyecciones, site._id);
      console.log(`[Scraping Service] Procesadas ${projections.length} proyecciones válidas`);

      if (projections.length > 0) {
        console.log(`[Scraping Service] Insertando ${projections.length} proyecciones en la base de datos`);
        await this.insertProjections(projections, site);
        await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length);
        console.log(`[Scraping Service] ${projections.length} proyecciones procesadas exitosamente para ${site.nombre}`);
      } else {
        console.log(`[Scraping Service] No se encontraron proyecciones válidas para ${site.nombre}`);
        await this.updateSiteAndHistory(site._id, 'exitoso', 'Sin proyecciones encontradas', 0);
      }

      // Asegurar que existe un schedule para el sitio
      let schedule = await ScrapingSchedule.findOne({ sitioId: site._id });
      if (!schedule) {
        // Crear un nuevo schedule con valores por defecto
        schedule = new ScrapingSchedule({
          sitioId: site._id,
          tipoFrecuencia: 'diaria', // Valor por defecto
          configuraciones: [{
            hora: '00:00' // Hora por defecto
          }],
          activo: true
        });
      }

      // Actualizar el schedule
      schedule.ultimaEjecucion = new Date();
      schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
      await schedule.save();
      console.log(`[Scraping Service] Schedule actualizado para ${site.nombre}. Próxima ejecución: ${schedule.proximaEjecucion}`);

      // Schedule next execution
      const timeUntilNext = schedule.proximaEjecucion.getTime() - new Date().getTime();
      if (timeUntilNext > 0) {
        const timerId = schedule._id.toString();
        const timer = setTimeout(async () => {
          await this.processSingleSite(site);
          this.scheduledTimers.delete(timerId);
        }, timeUntilNext);
        this.scheduledTimers.set(timerId, timer);
        console.log(`[Scraping Service] Programada próxima ejecución para ${site.nombre} en ${timeUntilNext}ms`);
      }

    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      console.error(`[Scraping Service] Error procesando sitio ${site.nombre}:`, {
        error: errorMessage,
        stack: error.stack,
        responseData: error.response?.data
      });
      await this.updateSiteAndHistory(site._id, 'fallido', errorMessage, 0);
      
      setTimeout(async () => {
        await this.processSingleSite(site);
      }, CONFIG.RETRY_DELAY);

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.serviceAvailable = false;
      }
    }
  }

  extractBasicInfo(htmlContent) {
    console.log('[Scraping Service] Iniciando extracción de información básica');
    const $ = cheerio.load(htmlContent);
    let extractedText = '';
    let elementCount = 0;

    $('body').find('*').each((index, element) => {
      if ($(element).is('script, style, meta, link')) return;

      const text = $(element).clone().children().remove().end().text().trim();
      if (text) {
        extractedText += `${text}\n`;
        elementCount++;
      }

      if ($(element).is('img')) {
        const alt = $(element).attr('alt');
        const src = $(element).attr('src');
        if (alt || src) {
          extractedText += `Imagen: ${alt || 'Sin descripción'} (${src})\n`;
          elementCount++;
        }
      }
    });

    console.log(`[Scraping Service] Extracción completada: ${elementCount} elementos procesados`);
    return extractedText.trim();
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
      
      const parsedContent = JSON.parse(content);
      console.log(`[Scraping Service] Respuesta OpenAI procesada exitosamente:`, {
        proyeccionesCount: parsedContent.proyecciones?.length || 0
      });

      return parsedContent;
    } catch (error) {
      console.error('[Scraping Service] Error en OpenAI scrape:', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Error en procesamiento de OpenAI: ${error.message}`);
    }
  }

  async processAIResponse(proyecciones, siteId) {
    const currentYear = new Date().getFullYear();
    console.log(`[Scraping Service] Procesando ${proyecciones.length} proyecciones de OpenAI`);
    
    try {
      const site = await Site.findById(siteId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      const processedProjections = proyecciones
        .map(p => {
          try {
            let fechaHora = new Date(p.fechaHora || p.FechaHora);
            
            if (fechaHora < new Date()) {
              fechaHora.setFullYear(currentYear);
            } else {
              fechaHora.setFullYear(Math.max(fechaHora.getFullYear(), currentYear));
            }

            let precio = 0;
            if (site.esGratis) {
              precio = 0;
            } else {
              precio = parseFloat(p.precio || p.Precio) || site.precioDefault || null;
            }

            const projection = {
              nombrePelicula: p.nombre || p.Nombre,
              fechaHora: fechaHora,
              director: p.director || p.Director || 'No especificado',
              genero: p.genero || p.Genero || 'No especificado',
              duracion: parseInt(p.duracion || p.Duracion) || 0,
              sala: p.sala || p.Sala || 'No especificada',
              precio: precio,
              sitio: siteId
            };

            console.log(`[Scraping Service] Proyección procesada:`, {
              nombre: projection.nombrePelicula,
              fecha: projection.fechaHora,
              sala: projection.sala
            });

            return projection;
          } catch (error) {
            console.error('[Scraping Service] Error procesando proyección individual:', error);
            return null;
          }
        })
        .filter(p => p && p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));

      console.log(`[Scraping Service] Procesamiento completado: ${processedProjections.length} proyecciones válidas`);
      return processedProjections;
    } catch (error) {
      console.error('[Scraping Service] Error al procesar respuesta del sitio:', error);
      return [];
    }
  }

  async insertProjections(projections, site) {
    console.log(`[Scraping Service] Iniciando inserción de ${projections.length} proyecciones para ${site.nombre}`);
    let insertedCount = 0;
    let updatedCount = 0;

    for (const projection of projections) {
      try {
        const claveUnica = `${projection.nombrePelicula}-${projection.fechaHora.toISOString()}-${site._id}`;
        const result = await Projection.findOneAndUpdate(
          { claveUnica },
          { 
            ...projection, 
            sitio: site._id, 
            nombreCine: site.nombre,
            claveUnica
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (result.isNew) {
          insertedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`[Scraping Service] Proyección duplicada ignorada: ${projection.nombrePelicula} en ${site.nombre}`);
        } else {
          console.error('[Scraping Service] Error al insertar/actualizar proyección:', error);
        }
      }
    }

    console.log(`[Scraping Service] Inserción completada para ${site.nombre}:`, {
      insertadas: insertedCount,
      actualizadas: updatedCount
    });
  }

  removeJob(siteId) {
    console.log(`[Scraping Service] Removiendo job para sitio: ${siteId}`);
    const timerId = siteId.toString();
    if (this.scheduledTimers.has(timerId)) {
      clearTimeout(this.scheduledTimers.get(timerId));
      this.scheduledTimers.delete(timerId);
    }
    delete this.jobs[siteId];
    delete this.lastRunTimes[siteId];
    delete this.nextScheduledRuns[siteId];
    console.log(`[Scraping Service] Job removido exitosamente para sitio: ${siteId}`);
  }

  async updateJob(site) {
    console.log('[Scraping Service] updateJob llamado para sitio:', site._id);
    try {
      if (site.activoParaScraping) {
        this.removeJob(site._id);
        await this.scheduleJob(site);
        console.log('[Scraping Service] Job actualizado exitosamente para sitio:', site._id);
      } else {
        this.removeJob(site._id);
        console.log('[Scraping Service] Job removido para sitio:', site._id);
      }
    } catch (error) {
      console.error('[Scraping Service] Error en updateJob:', error);
      throw error;
    }
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    try {
      await Site.findByIdAndUpdate(siteId, {
        $set: { 'configuracionScraping.ultimoScrapingExitoso': new Date() }
      });

      await ScrapingHistory.create({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones,
        fechaScraping: new Date()
      });

      console.log(`[Scraping Service] Historial actualizado para sitio ${siteId}:`, {
        estado,
        cantidadProyecciones,
        error: mensajeError || 'ninguno'
      });
    } catch (error) {
      console.error('[Scraping Service] Error al actualizar historial:', error);
    }
  }

  scheduleJob(site) {
    console.log(`[Scraping Service] Agregando ${site.nombre} a la cola de scraping`);
    this.jobs[site._id] = {
      site: site,
      lastRun: null
    };
  }

  async obtenerProximoScraping() {
    try {
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId')
        .sort({ proximaEjecucion: 1 })
        .limit(1);

      if (schedules.length === 0 || !schedules[0].sitioId) {
        return null;
      }

      return {
        nombre: schedules[0].sitioId.nombre,
        fechaScraping: schedules[0].proximaEjecucion
      };
    } catch (error) {
      console.error('[Scraping Service] Error al obtener próximo scraping:', error);
      return null;
    }
  }
}

module.exports = new ScrapingService();
