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
  BATCH_SIZE: 5,
  BATCH_INTERVAL: 60000,
  SERVICE_CHECK_INTERVAL: 300000
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
  }

  async initializeJobs() {
    console.log('Iniciando inicialización de trabajos de scraping...');
    try {
      const sites = await Site.find({ activoParaScraping: true });
      console.log(`Encontrados ${sites.length} sitios activos para scraping`);
      
      sites.forEach(site => this.scheduleJob(site));
      
      this.startServiceCheck();
      console.log(`Inicializados ${sites.length} trabajos de scraping. Esperando disponibilidad del servicio.`);
    } catch (error) {
      console.error('Error al inicializar jobs:', error);
    }
  }

  async getSchedule() {
    try {
      console.log('Obteniendo horarios de scraping');
      
      // Obtener schedules activos con su información de sitio
      const schedules = await ScrapingSchedule.find({ activo: true })
        .populate('sitioId', 'nombre frecuenciaActualizacion');

      console.log(`Encontrados ${schedules.length} schedules activos`);

      const scheduleInfo = schedules
        .filter(schedule => schedule.sitioId) // Asegurarse que el sitio existe
        .map(schedule => ({
          siteId: schedule.sitioId._id,
          nombre: schedule.sitioId.nombre,
          frecuencia: schedule.tipoFrecuencia,
          ultimoScraping: schedule.ultimaEjecucion || null,
          proximoScraping: schedule.proximaEjecucion
        }));

      console.log('Horarios procesados exitosamente:', scheduleInfo);
      return scheduleInfo;
    } catch (error) {
      console.error('Error al obtener horarios de scraping:', error);
      throw error;
    }
  }

  startServiceCheck() {
    this.checkServiceAvailability().then(available => {
      if (available) {
        this.startQueueProcessor();
      }
    });

    setInterval(async () => {
      this.serviceAvailable = await this.checkServiceAvailability();
      if (this.serviceAvailable && !this.isProcessingQueue) {
        this.startQueueProcessor();
      }
    }, CONFIG.SERVICE_CHECK_INTERVAL);
  }

  async checkServiceAvailability() {
    console.log('Verificando disponibilidad del servicio de scraping...');
    try {
      const response = await axios.get(`${SCRAPING_SERVICE_URL}/api/health`, {
        timeout: CONFIG.HEALTH_CHECK_TIMEOUT
      });
      const available = response.status === 200;
      console.log(`Servicio de scraping ${available ? 'disponible' : 'no disponible'}`);
      return available;
    } catch (error) {
      console.log('Servicio de scraping no disponible:', error.message);
      return false;
    }
  }

  startQueueProcessor() {
    if (!this.serviceAvailable || this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    console.log('Iniciando procesamiento de cola');

    const processNext = async () => {
      if (!this.serviceAvailable) {
        console.log('Servicio no disponible. Deteniendo procesamiento.');
        this.isProcessingQueue = false;
        return;
      }

      if (this.scrapingQueue.length === 0) {
        console.log('Cola vacía. Deteniendo procesamiento.');
        this.isProcessingQueue = false;
        return;
      }

      const batch = this.scrapingQueue.splice(0, CONFIG.BATCH_SIZE);
      console.log(`Procesando lote de ${batch.length} sitios`);

      try {
        await Promise.all(batch.map(site => this.processSingleSite(site)));
      } catch (error) {
        console.error('Error procesando batch:', error);
      }

      setTimeout(() => processNext(), CONFIG.BATCH_INTERVAL);
    };

    processNext();
  }

  async processSingleSite(site) {
    if (!this.serviceAvailable) return;

    console.log(`Procesando sitio: ${site.nombre}`);
    try {
      const scrapeResponse = await axios.post(
        `${SCRAPING_SERVICE_URL}/api/scrape`,
        { url: site.url },
        { timeout: CONFIG.SCRAPING_TIMEOUT }
      );

      if (!scrapeResponse.data?.data) {
        throw new Error('No se recibió contenido HTML');
      }

      const htmlContent = scrapeResponse.data.data;
      const extractedInfo = this.extractBasicInfo(htmlContent);
      const openAIResponse = await this.openAIScrape(site, extractedInfo);
      
      let proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
      if (!Array.isArray(proyecciones)) {
        throw new Error('Formato de respuesta OpenAI inválido');
      }

      const projections = this.processAIResponse(proyecciones, site._id);
      if (projections.length > 0) {
        await this.insertProjections(projections, site);
        await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length);
        console.log(`${projections.length} proyecciones procesadas para ${site.nombre}`);
      } else {
        await this.updateSiteAndHistory(site._id, 'exitoso', 'Sin proyecciones encontradas', 0);
      }

      // Actualizar el schedule después de una ejecución exitosa
      const schedule = await ScrapingSchedule.findOne({ sitioId: site._id });
      if (schedule) {
        schedule.ultimaEjecucion = new Date();
        schedule.proximaEjecucion = schedule.calcularProximaEjecucion();
        await schedule.save();
      }

    } catch (error) {
      console.error(`Error procesando sitio ${site.nombre}:`, error.message);
      await this.updateSiteAndHistory(site._id, 'fallido', error.message, 0);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.serviceAvailable = false;
      }
    }
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

  async openAIScrape(site, extractedInfo) {
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

  async processAIResponse(proyecciones, siteId) {
    const currentYear = new Date().getFullYear();
    
    try {
      const site = await Site.findById(siteId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      return proyecciones
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

            return {
              nombrePelicula: p.nombre || p.Nombre,
              fechaHora: fechaHora,
              director: p.director || p.Director || 'No especificado',
              genero: p.genero || p.Genero || 'No especificado',
              duracion: parseInt(p.duracion || p.Duracion) || 0,
              sala: p.sala || p.Sala || 'No especificada',
              precio: precio,
              sitio: siteId
            };
          } catch (error) {
            console.error('Error procesando proyección individual:', error);
            return null;
          }
        })
        .filter(p => p && p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
    } catch (error) {
      console.error('Error al procesar respuesta del sitio:', error);
      return [];
    }
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
          console.log(`Proyección duplicada ignorada: ${projection.nombrePelicula} en ${site.nombre}`);
        } else {
          console.error('Error al insertar/actualizar proyección:', error);
        }
      }
    }
  }

  removeJob(siteId) {
    console.log(`Removiendo job para sitio: ${siteId}`);
    // Remover de la cola de scraping
    this.scrapingQueue = this.scrapingQueue.filter(site => site._id.toString() !== siteId.toString());
    // Limpiar datos del job
    delete this.jobs[siteId];
    delete this.lastRunTimes[siteId];
    delete this.nextScheduledRuns[siteId];
    console.log(`Job removido exitosamente para sitio: ${siteId}`);
  }

  async updateJob(site) {
    console.log('ScrapingService.updateJob llamado para sitio:', site._id);
    try {
      if (site.activoParaScraping) {
        // Primero remover el job existente si existe
        this.removeJob(site._id);
        // Luego programar el nuevo job
        await this.scheduleJob(site);
        console.log('Job actualizado exitosamente para sitio:', site._id);
      } else {
        this.removeJob(site._id);
        console.log('Job removido para sitio:', site._id);
      }
    } catch (error) {
      console.error('Error en ScrapingService.updateJob:', error);
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
    } catch (error) {
      console.error('Error al actualizar historial:', error);
    }
  }

  scheduleJob(site) {
    console.log(`Agregando ${site.nombre} a la cola de scraping`);
    this.scrapingQueue.push(site);
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
      console.error('Error al obtener próximo scraping:', error);
      return null;
    }
  }
}

module.exports = new ScrapingService();
