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

// Configuración de reintentos y delays
const RETRY_DELAYS = [1000, 3000, 5000]; // Delays para reintentos en ms
const HEALTH_CHECK_TIMEOUT = 5000;
const SCRAPING_TIMEOUT = 60000;

class ScrapingService {
  constructor() {
    this.jobs = {};
    this.lastRunTimes = {};
    this.nextScheduledRuns = {};
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async initializeJobs() {
    console.log('Iniciando inicialización de trabajos de scraping...');
    try {
      const sites = await Site.find({ activoParaScraping: true });
      sites.forEach(site => this.scheduleJob(site));
      console.log(`Inicializados ${sites.length} trabajos de scraping.`);
    } catch (error) {
      console.error('Error al inicializar jobs:', error);
    }
  }

  async checkServiceAvailability() {
    try {
      const healthCheck = await axios.get(`${SCRAPING_SERVICE_URL}/api/health`, {
        timeout: HEALTH_CHECK_TIMEOUT,
        headers: {
          'Accept': 'application/json',
          'X-Source': 'FilmFetcher'
        }
      });
      return healthCheck.status === 200;
    } catch (error) {
      console.error('Error en health check:', error.message);
      return false;
    }
  }

  async performScraping(url) {
    try {
      console.log(`Intentando scraping para URL: ${url}`);
      const response = await axios.post(
        `${SCRAPING_SERVICE_URL}/api/scrape`,
        { url },
        {
          timeout: SCRAPING_TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'FilmFetcher'
          },
          validateStatus: status => status < 500
        }
      );

      if (!response.data || response.data.status === 'error') {
        throw new Error(response.data?.error || 'Error en respuesta del servicio de scraping');
      }

      return response.data;
    } catch (error) {
      console.error('Error en performScraping:', error);
      if (error.response?.status === 503) {
        throw new Error('Servicio temporalmente no disponible');
      }
      throw new Error(`Error en scraping: ${error.message}`);
    }
  }

  async scrapeSite(site) {
    console.log(`==================== INICIO DE SCRAPING PARA ${site.nombre} ====================`);
    console.log(`Iniciando scraping para ${site.nombre} (${site.url}) en ${new Date().toISOString()}`);
    this.lastRunTimes[site._id] = new Date();
    
    let respuestaOpenAI = '';
    let causaFallo = '';

    for (let intento = 0; intento < RETRY_DELAYS.length; intento++) {
      try {
        // Verificar disponibilidad del servicio
        const isServiceAvailable = await this.checkServiceAvailability();
        if (!isServiceAvailable) {
          throw new Error('Servicio de scraping no disponible');
        }

        if (!site.url || !site.url.startsWith('http')) {
          throw new Error('URL inválida');
        }

        // Realizar scraping
        const scrapeResponse = await this.performScraping(site.url);
        const htmlContent = scrapeResponse.data;
        
        if (!htmlContent) {
          throw new Error('No se recibió contenido HTML');
        }

        const extractedInfo = this.extractBasicInfo(htmlContent);
        const openAIResponse = await this.openAIScrape(site, extractedInfo);
        respuestaOpenAI = JSON.stringify(openAIResponse);

        const proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
        if (!Array.isArray(proyecciones)) {
          throw new Error('Formato de respuesta OpenAI inválido');
        }

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
        console.error(`Error en intento ${intento + 1}/${RETRY_DELAYS.length}:`, {
          sitio: site.nombre,
          error: error.message,
          stack: error.stack
        });
        
        if (intento < RETRY_DELAYS.length - 1) {
          console.log(`Reintentando en ${RETRY_DELAYS[intento]}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[intento]));
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
      }
    }

    console.log(`==================== FIN DE SCRAPING PARA ${site.nombre} ====================`);
  }

  scheduleJob(site) {
    console.log(`Programando job para ${site.nombre}`);
    this.jobs[site._id] = {
      site: site,
      lastRun: null
    };

    if (site.frecuenciaActualizacion === 'test') {
      console.log(`Forzando ejecución inmediata para ${site.nombre}`);
      this.scrapeSite(site);
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
    const prompt = `Analiza el siguiente texto extraído de un sitio web de cine y extrae información sobre las proyecciones:

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
    Si no encuentras nada, devuelve un array vacío. Asume que el año es el actual (2024), salvo que sea explicito que no lo es. Devuelve SOLO el JSON con los titulos en propercase, sin ningún texto adicional ni marcadores de código.`;

    try {
      const response = await openai.chat.completions.create({
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

      let aiResponse = JSON.parse(content);
      console.log('Respuesta parseada de OpenAI:', aiResponse);
      return aiResponse;
    } catch (error) {
      console.error('Error en OpenAI scrape:', error);
      throw error;
    }
  }

  processAIResponse(proyecciones, siteId) {
    if (!Array.isArray(proyecciones)) {
      console.error('processAIResponse recibió proyecciones no válidas:', proyecciones);
      return [];
    }
    const currentYear = new Date().getFullYear();
    return proyecciones.map(p => {
      let fechaHora = new Date(p.fechaHora || p.FechaHora);
      
      if (fechaHora < new Date()) {
        fechaHora.setFullYear(currentYear);
      } else {
        fechaHora.setFullYear(Math.max(fechaHora.getFullYear(), currentYear));
      }

      return {
        nombrePelicula: p.nombre || p.Nombre,
        fechaHora: fechaHora,
        director: p.director || p.Director || 'No especificado',
        genero: p.genero || p.Genero || 'No especificado',
        duracion: parseInt(p.duracion || p.Duracion) || 0,
        sala: p.sala || p.Sala || 'No especificada',
        precio: parseFloat(p.precio || p.Precio) || 0,
        sitio: siteId
      };
    }).filter(p => p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
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
          console.log(`Proyección duplicada ignorada: ${projection.nombrePelicula} en ${site.nombre} a las ${projection.fechaHora}`);
        } else {
          console.error('Error al insertar/actualizar proyección:', error);
          throw error;
        }
      }
    }
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones, respuestaOpenAI, causaFallo = '') {
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
  }

  updateJob(site) {
    if (site.activoParaScraping) {
      this.scheduleJob(site);
    } else {
      this.removeJob(site._id);
    }
  }

  removeJob(siteId) {
    if (this.jobs[siteId]) {
      delete this.jobs[siteId];
      console.log(`Job removido para el sitio con ID: ${siteId}`);
    }
  }

  async getSchedule() {
    const sites = await Site.find({ activoParaScraping: true });
    const now = new Date();
    return sites.flatMap(site => 
      Array.from({ length: 10 }, (_, i) => {
        const date = this.calcularProximoScraping(site, now, i);
        return {
          siteId: site._id,
          nombre: site.nombre,
          frecuencia: site.frecuenciaActualizacion,
          fechaScraping: date
        };
      })
    ).sort((a, b) => a.fechaScraping - b.fechaScraping);
  }

  calcularProximoScraping(site, fromDate) {
    const date = new Date(fromDate);
    const ahora = new Date();
    
    switch (site.frecuenciaActualizacion) {
      case 'diaria':
        date.setHours(0, 0, 0, 0);
        if (date <= ahora) {
          date.setDate(date.getDate() + 1);
        }
        break;
      case 'semanal':
        date.setHours(0, 0, 0, 0);
        while (date <= ahora) {
          date.setDate(date.getDate() + 7);
        }
        break;
      case 'mensual':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        while (date <= ahora) {
          date.setMonth(date.getMonth() + 1);
        }
        break;
      case 'test':
        date.setMinutes(date.getMinutes() + 1);
        break;
      default:
        console.error(`Frecuencia de actualización no válida: ${site.frecuenciaActualizacion}`);
        return null;
    }
    
    return date;
  }

  async obtenerProximoScraping() {
    const sitios = await Site.find({ activoParaScraping: true });
    const ahora = new Date();
    let proximoScraping = null;

    for (const sitio of sitios) {
      const proximaFecha = this.calcularProximoScraping(sitio, ahora);
      if (proximaFecha && (!proximoScraping || proximaFecha < proximoScraping.fechaScraping)) {
        proximoScraping = {
          nombre: sitio.nombre,
          fechaScraping: proximaFecha
        };
      }
    }

    return proximoScraping;
  }

  async getDiagnosticInfo() {
    console.log('Obteniendo información de diagnóstico de scraping...');
    const sites = await Site.find({ activoParaScraping: true });
    return sites.map(site => {
      const jobInfo = this.jobs[site._id];
      const lastRun = this.lastRunTimes[site._id];
      const nextRun = this.nextScheduledRuns[site._id];
      return {
        id: site._id,
        nombre: site.nombre,
        frecuencia: site.frecuenciaActualizacion,
        ultimaEjecucion: lastRun ? lastRun.toISOString() : 'Nunca',
        tiempoDesdeUltimaEjecucion: lastRun ? `${Math.round((new Date() - lastRun) / 1000)} segundos` : 'N/A',
        jobActivo: !!jobInfo,
        proximaEjecucion: nextRun ? nextRun.toISOString() : 'No programado',
        expresionCron: this.getCronExpression(site.frecuenciaActualizacion),
        entorno: process.env.NODE_ENV === "production" ? 'Producción' : 'Desarrollo'
      };
    });
  }
}

module.exports = new ScrapingService();