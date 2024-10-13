const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');

require('dotenv').config();

class ScrapingService {
  constructor() {
    this.jobs = {};
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async initializeJobs() {
    const sites = await Site.find({ activoParaScraping: true });
    sites.forEach(site => this.scheduleJob(site));
    console.log(`Inicializados ${sites.length} trabajos de scraping.`);

    // Configurar un observador para cambios en la colección de sitios
    this.setupSiteChangeObserver();
  }

  setupSiteChangeObserver() {
    const siteChangeStream = Site.watch();
    siteChangeStream.on('change', async (change) => {
      if (change.operationType === 'insert' || change.operationType === 'update') {
        const updatedSite = await Site.findById(change.documentKey._id);
        if (updatedSite && updatedSite.activoParaScraping) {
          this.updateJob(updatedSite);
        } else if (this.jobs[change.documentKey._id]) {
          this.removeJob(change.documentKey._id);
        }
      } else if (change.operationType === 'delete') {
        this.removeJob(change.documentKey._id);
      }
    });
  }

  scheduleJob(site) {
    const cronExpression = this.getCronExpression(site.frecuenciaActualizacion);
    if (!cronExpression) return;

    if (this.jobs[site._id]) {
      this.jobs[site._id].stop();
    }

    this.jobs[site._id] = cron.schedule(cronExpression, () => this.scrapeSite(site));
    console.log(`Job programado o actualizado para ${site.nombre}: ${cronExpression}`);
  }

  getCronExpression(frecuencia) {
    const expresiones = {
      diaria: '0 0 * * *',
      semanal: '0 0 * * 0',
      mensual: '0 0 1 * *',
      test: '*/1 * * * *'
    };
    return expresiones[frecuencia];
  }

  async scrapeSite(site) {
    console.log(`==================== INICIO DE SCRAPING PARA ${site.nombre} ====================`);
    console.log(`Iniciando scraping para ${site.nombre} (${site.url})`);
    let browser;
    let respuestaOpenAI = '';
    let causaFallo = '';
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        defaultViewport: null
      });
      const page = await browser.newPage();
      
      await page.goto(site.url, { 
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      const htmlContent = await page.content();
      const extractedInfo = this.extractBasicInfo(htmlContent);
      const openAIResponse = await this.openAIScrape(site, extractedInfo);
      respuestaOpenAI = JSON.stringify(openAIResponse);
      console.log('Respuesta de OpenAI:', respuestaOpenAI);

      let proyecciones = openAIResponse.proyecciones || openAIResponse.Proyecciones;
      if (!Array.isArray(proyecciones)) {
        causaFallo = 'La respuesta de OpenAI no contiene un array de proyecciones válido';
        console.error(causaFallo);
        throw new Error(causaFallo);
      }

      const projections = this.processAIResponse(proyecciones, site._id);

      if (projections.length > 0) {
        try {
          await this.insertProjections(projections, site);
          console.log(`${projections.length} proyecciones procesadas correctamente para ${site.nombre}`);
          await this.updateSiteAndHistory(site._id, 'exitoso', null, projections.length, respuestaOpenAI);
        } catch (dbError) {
          causaFallo = 'Error al procesar las proyecciones en la base de datos';
          console.error(causaFallo, dbError);
          throw new Error(`${causaFallo}: ${dbError.message}`);
        }
      } else {
        causaFallo = 'No se encontraron proyecciones válidas';
        console.log(causaFallo);
        await this.updateSiteAndHistory(site._id, 'exitoso', causaFallo, 0, respuestaOpenAI);
      }
    } catch (error) {
      causaFallo = `Error en scraping: ${error.message}`;
      console.error(`Error en scraping de ${site.nombre}:`, error);
      console.error('Stack trace completo:', error.stack);
      await this.updateSiteAndHistory(site._id, 'fallido', error.message, 0, respuestaOpenAI, causaFallo);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
    console.log(`==================== FIN DE SCRAPING PARA ${site.nombre} ====================`);
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
    Si no encuentras nada, devuelve un array vacío. Devuelve SOLO el JSON con los titulos en propercase, sin ningún texto adicional ni marcadores de código como \`\`\`json.`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Eres un experto en extraer información de cine de texto HTML. Tu tarea es analizar el texto proporcionado y extraer información sobre las proyecciones de películas." },
            { role: "user", content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 8000
        },
        { headers: { 'Authorization': `Bearer ${this.openaiApiKey}`, 'Content-Type': 'application/json' } }
      );

      let content = response.data.choices[0]?.message?.content.trim() || "{}";
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
      
      // Si la fecha es del pasado, asumimos que es del próximo año
      if (fechaHora < new Date()) {
        fechaHora.setFullYear(currentYear);
      } else {
        // Si no, aseguramos que sea al menos del año actual
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
      this.jobs[siteId].stop();
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

  calcularProximoScraping(site, fromDate, index) {
    const date = new Date(fromDate);
    const addTime = {
      diaria: () => date.setDate(date.getDate() + index),
      semanal: () => date.setDate(date.getDate() + 7 * index),
      mensual: () => date.setMonth(date.getMonth() + index),
      test: () => date.setMinutes(date.getMinutes() + index)
    };
    addTime[site.frecuenciaActualizacion]();
    return date;
  }
}

module.exports = new ScrapingService();