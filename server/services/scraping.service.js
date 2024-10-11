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
    console.log('Inicializando trabajos de scraping...');
    const sites = await Site.find({ activoParaScraping: true });
    sites.forEach(site => this.scheduleJob(site));
    console.log(`Inicializados ${sites.length} trabajos de scraping.`);
  }

  scheduleJob(site) {
    let cronExpression;
    switch (site.frecuenciaActualizacion) {
      case 'diaria':
        cronExpression = '0 0 * * *';
        break;
      case 'semanal':
        cronExpression = '0 0 * * 0';
        break;
      case 'mensual':
        cronExpression = '0 0 1 * *';
        break;
      case 'test':
        cronExpression = '*/1 * * * *'; // Cada 1 minuto para pruebas
        break;
      default:
        console.error(`Frecuencia de actualización no válida para el sitio ${site.nombre}`);
        return;
    }

    console.log(`Programando job para el sitio ${site.nombre} con expresión cron: ${cronExpression}`);
    this.jobs[site._id] = cron.schedule(cronExpression, () => {
      console.log(`Ejecutando scraping programado para el sitio: ${site.nombre}`);
      this.scrapeSite(site);
    });
  }

  async scrapeSite(site, res) {
    global.currentResponse = res;  // Establecer la respuesta actual para el logging
    console.log(`Iniciando scraping para el sitio: ${site.nombre} (${site.url})`);
    try {
      const htmlContent = await this.fetchHtmlContent(site.url);
      const extractedInfo = this.extractBasicInfo(htmlContent);
      const projections = await this.openAIScrape(site, extractedInfo);

      if (projections && projections.length > 0) {
        await Projection.insertMany(projections);
        console.log(`${projections.length} proyecciones insertadas en la base de datos para ${site.nombre}`);

        await Site.findByIdAndUpdate(site._id, {
          $set: { 'configuracionScraping.ultimoScrapingExitoso': new Date() }
        });

        await this.saveScrapingHistory(site._id, 'exitoso', null, projections.length);
      } else {
        console.log(`No se encontraron proyecciones para el sitio ${site.nombre}`);
        await this.saveScrapingHistory(site._id, 'exitoso', 'No se encontraron proyecciones', 0);
      }

      console.log(`Scraping completado con éxito para el sitio: ${site.nombre}`);
    } catch (error) {
      console.error(`Error al hacer scraping del sitio ${site.nombre}:`, error);
      console.error('Stack trace completo:', error.stack);
      await Site.findByIdAndUpdate(site._id, {
        $push: { 'configuracionScraping.errores': { fecha: new Date(), mensaje: error.message } }
      });
      await this.saveScrapingHistory(site._id, 'fallido', error.message, 0);
    } finally {
      global.currentResponse = null;  // Limpiar la respuesta actual
    }
  }

  async fetchHtmlContent(url) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching HTML content from ${url}:`, error);
      throw error;
    }
  }

  extractBasicInfo(htmlContent) {
    const $ = cheerio.load(htmlContent);
    let extractedInfo = [];
  
    $('div').each((index, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      if (text.match(/(?:Ju|Vi|Sá|Do|Mi)\s*\|\s*\d{2}:\d{2}/)) {
        extractedInfo.push(text);
      }
    });
  
    // Limitamos a un máximo de 10 elementos para no sobrecargar la API de OpenAI
    const result = extractedInfo.slice(0, 10).join(' | ');
    console.log('Información extraída:', result);
    return result;
  }

  async openAIScrape(site, extractedInfo) {
    console.log('==================== INICIO DE SCRAPING OPENAI ====================');
    console.log(`Ejecutando análisis basado en OpenAI para el sitio: ${site.nombre}`);
    console.log('Información extraída enviada a OpenAI:');
    console.log(extractedInfo);
    console.log('------------------------------------------------------------------');
  
    const maxRetries = 3;
    let retryCount = 0;
  
    while (retryCount < maxRetries) {
      try {
        const promptContent = `Analiza el siguiente texto extraído de un sitio web de cine o teatro y extrae información sobre las proyecciones únicamente de cine:
  
        ${extractedInfo}
  
        Incluye el nombre de la película o evento, la fecha y hora, el director (si está disponible), el género, la duración, la sala y el precio. Devuelve la información en formato JSON siguiendo este esquema:
        {
          "proyecciones": [
            {
              "nombre": "string",
              "fechaHora": "string (formato ISO)",
              "director": "string",
              "genero": "string",
              "duracion": "number (minutos)",
              "sala": "string",
              "precio": "number"
            }
          ]
        }
        Si no encuentras información para algún campo, infierelo de internet con máxima precisión. Devuelve SOLO el JSON en propercase, sin ningún otro texto o formato adicional.`;
  
        console.log('Prompt enviado a OpenAI:');
        console.log(promptContent);
        console.log('------------------------------------------------------------------');
  
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "Eres un asistente experto en extraer información sobre proyecciones de cine y teatro. Tu tarea es analizar el texto proporcionado y extraer información sobre las proyecciones o eventos. Devuelve SOLO el JSON sin ningún otro texto o formato adicional."
              },
              {
                role: "user",
                content: promptContent
              }
            ],
            temperature: 0.2,
            max_tokens: 4000
          },
          {
            headers: {
              'Authorization': `Bearer ${this.openaiApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
  
        console.log('Respuesta completa de OpenAI:');
        console.log(JSON.stringify(response.data, null, 2));
        console.log('------------------------------------------------------------------');
  
        let content = response.data.choices[0]?.message?.content || "{}";
        console.log('Contenido de la respuesta de OpenAI antes de la limpieza:');
        console.log(content);
        console.log('------------------------------------------------------------------');
  
        content = content.replace(/```json\n?|\n?```/g, '').trim();
        console.log('Contenido de la respuesta de OpenAI después de la limpieza:');
        console.log(content);
        console.log('------------------------------------------------------------------');
  
        let aiResponse;
        try {
          aiResponse = JSON.parse(content);
        } catch (parseError) {
          console.error('Error al parsear la respuesta de OpenAI:', parseError);
          console.error('Contenido que causó el error:', content);
          throw new Error(`No se pudo parsear la respuesta de OpenAI: ${parseError.message}`);
        }
        
        // Modificación: Verificar si la propiedad es 'proyecciones' o 'Proyecciones'
        const proyecciones = aiResponse.proyecciones || aiResponse.Proyecciones;
        if (!proyecciones || !Array.isArray(proyecciones)) {
          console.error('Respuesta de OpenAI no contiene proyecciones válidas:', aiResponse);
          throw new Error('Respuesta de OpenAI no contiene proyecciones válidas');
        }
  
        console.log('==================== FIN DE SCRAPING OPENAI ====================');
        return this.processAIResponse(aiResponse, site._id);
      } catch (error) {
        console.error(`Error en el intento ${retryCount + 1} para el sitio ${site.nombre}:`, error);
        if (error.response) {
          console.error('Detalles de la respuesta de error:', error.response.data);
        }
        if (error.response && (error.response.status === 429 || error.response.status === 403)) {
          retryCount++;
          if (retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`Esperando ${delay}ms antes del próximo intento...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw new Error('Máximo número de reintentos alcanzado');
          }
        } else {
          throw error;
        }
      }
    }
  }

  processAIResponse(aiResponse, siteId) {
    // Modificación: Verificar si la propiedad es 'proyecciones' o 'Proyecciones'
    const proyecciones = aiResponse.proyecciones || aiResponse.Proyecciones;
    return proyecciones.map(event => ({
      nombrePelicula: event.nombre || event.Nombre,
      fechaHora: new Date(event.fechaHora || event.FechaHora),
      director: event.director || event.Director || 'No especificado',
      genero: event.genero || event.Genero || 'No especificado',
      duracion: event.duracion || event.Duracion ? parseInt(event.duracion || event.Duracion) : 0,
      sala: event.sala || event.Sala || 'No especificada',
      precio: event.precio || event.Precio ? parseFloat(event.precio || event.Precio) : 0,
      sitio: siteId,
    })).filter(projection => 
      projection.nombrePelicula && 
      projection.fechaHora && 
      !isNaN(projection.fechaHora.getTime())
    );
  }

  alternativeExtraction(extractedInfo) {
    console.log("Utilizando método de extracción alternativo");
    const proyecciones = [];

    // Expresiones regulares para extraer información
    const peliculaRegex = /([^/]+?)(?:\s+\/|\s+Dir:|\s+\d+m|$)/g;
    const directorRegex = /Dir:\s*([^/\n]+)/;
    const duracionRegex = /(\d+)\s*m/;
    const fechaHoraRegex = /(\w{2}\s\w{2}\s\w{2}\s\w{2}\s\w{2})\s*\|\s*(\d{2}:\d{2})/;

    let match;
    while ((match = peliculaRegex.exec(extractedInfo)) !== null) {
      const nombre = match[1].trim();
      const directorMatch = extractedInfo.slice(match.index).match(directorRegex);
      const duracionMatch = extractedInfo.slice(match.index).match(duracionRegex);
      const fechaHoraMatch = extractedInfo.slice(match.index).match(fechaHoraRegex);

      if (nombre && fechaHoraMatch) {
        proyecciones.push({
          nombre,
          fechaHora: new Date(`2024 ${fechaHoraMatch[1]} ${fechaHoraMatch[2]}`).toISOString(),
          director: directorMatch ? directorMatch[1].trim() : 'No especificado',
          duracion: duracionMatch ? parseInt(duracionMatch[1]) : 0,
          sala: 'No especificada',
          precio: 0
        });
      }
    }

    return proyecciones;
  }

  async saveScrapingHistory(siteId, estado, mensajeError = null, cantidadProyecciones = 0) {
    console.log(`Guardando historial de scraping para el sitio ID: ${siteId}`);
    console.log(`Estado: ${estado}`);
    console.log(`Mensaje de error: ${mensajeError}`);
    console.log(`Cantidad de proyecciones: ${cantidadProyecciones}`);

    try {
      const nuevoHistorial = new ScrapingHistory({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones
      });

      console.log('Nuevo historial antes de guardar:', nuevoHistorial);

      const historicoGuardado = await nuevoHistorial.save();
      console.log(`Historial de scraping guardado para el sitio ID: ${siteId}`);
      console.log('Histórico guardado:', historicoGuardado);
    } catch (error) {
      console.error(`Error al guardar el historial de scraping para el sitio ID: ${siteId}`, error);
      if (error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error(`Error de validación en ${key}:`, error.errors[key].message);
        });
      }
    }
  }

  updateJob(site) {
    console.log(`Actualizando job para el sitio: ${site.nombre}`);
    if (this.jobs[site._id]) {
      this.jobs[site._id].stop();
    }
    if (site.activoParaScraping) {
      this.scheduleJob(site);
    }
  }

  removeJob(siteId) {
    console.log(`Removiendo job para el sitio ID: ${siteId}`);
    if (this.jobs[siteId]) {
      this.jobs[siteId].stop();
      delete this.jobs[siteId];
    }
  }

  async getSchedule() {
    console.log("Obteniendo schedule de scraping...");
    const sites = await Site.find({ activoParaScraping: true });
    const now = new Date();
    let allScheduledScrapings = [];

    sites.forEach(site => {
      const nextScrapings = this.calcularProximosScrapings(site, now);
      allScheduledScrapings = allScheduledScrapings.concat(nextScrapings);
    });

    allScheduledScrapings.sort((a, b) => a.fechaScraping - b.fechaScraping);

    return allScheduledScrapings;
  }

  async scrapeFromImage(imageUrl, sitioId) {
    console.log(`Iniciando scraping desde imagen para el sitio ID: ${sitioId}`);
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      const projections = await this.openAIScrapeImage(imageUrl);

      if (projections && projections.length > 0) {
        console.log(`${projections.length} proyecciones extraídas de la imagen para ${site.nombre}`);
        await this.saveScrapingHistory(sitioId, 'exitoso', null, projections.length);
      } else {
        console.log(`No se encontraron proyecciones en la imagen para el sitio ${site.nombre}`);
        await this.saveScrapingHistory(sitioId, 'exitoso', 'No se encontraron proyecciones', 0);
      }

      return projections.map(p => ({...p, sitio: sitioId}));
    } catch (error) {
      console.error(`Error al hacer scraping de la imagen para el sitio ${sitioId}:`, error);
      await this.saveScrapingHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  async openAIScrapeImage(imageUrl) {
    console.log('Ejecutando análisis basado en OpenAI para la imagen');
    
    const promptContent = `Analiza la siguiente imagen de una cartelera de cine o teatro y extrae información sobre las proyecciones de cine unicamente:

    Incluye el nombre de la película o evento, la fecha y hora, el director (si está disponible), el género, la duración, la sala y el precio. Devuelve la información en formato JSON siguiendo este esquema:
    {
      "proyecciones": [
        {
          "nombre": "string",
          "fechaHora": "string (formato ISO)",
          "director": "string",
          "genero": "string",
          "duracion": "number (minutos)",
          "sala": "string",
          "precio": "number"
        }
      ]
    }
    Si no encuentras información para algún campo, puedes inferirlo de internet. Devuelve SOLO el JSON con los datos en propercase, sin ningún otro texto o formato adicional.`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un asistente experto en extraer información sobre proyecciones de cine y teatro desde imágenes. Tu tarea es analizar la imagen proporcionada y extraer información sobre las proyecciones o eventos. Devuelve SOLO el JSON sin ningún otro texto o formato adicional."
            },
            {
              role: "user",
              content: [
                { type: "text", text: promptContent },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let content = response.data.choices[0]?.message?.content || "{}";
      content = content.replace(/```json\n?|\n?```/g, '').trim();
      
      let aiResponse;
      try {
        aiResponse = JSON.parse(content);
      } catch (parseError) {
        console.error('Error al parsear la respuesta de OpenAI:', parseError);
        throw new Error(`No se pudo parsear la respuesta de OpenAI: ${parseError.message}`);
      }
      
      if (!aiResponse.proyecciones || !Array.isArray(aiResponse.proyecciones)) {
        console.error('Respuesta de OpenAI no contiene proyecciones válidas:', aiResponse);
        throw new Error('Respuesta de OpenAI no contiene proyecciones válidas');
      }

      return this.processAIResponse(aiResponse);
    } catch (error) {
      console.error('Error en OpenAI scrape de imagen:', error);
      throw error;
    }
  }

  calcularProximosScrapings(site, now) {
    const scrapings = [];
    let nextDate = this.calcularProximoScraping(site, now);

    for (let i = 0; i < 10; i++) {
      scrapings.push({
        siteId: site._id,
        nombre: site.nombre,
        frecuencia: site.frecuenciaActualizacion,
        fechaScraping: new Date(nextDate)
      });
      nextDate = this.calcularProximoScraping(site, nextDate);
    }

    return scrapings;
  }

  calcularProximoScraping(site, fromDate) {
    const date = new Date(fromDate);
    switch (site.frecuenciaActualizacion) {
      case 'diaria':
        date.setDate(date.getDate() + 1);
        break;
      case 'semanal':
        date.setDate(date.getDate() + 7);
        break;
      case 'mensual':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'test':
        date.setMinutes(date.getMinutes() + 1);
        break
    }
    return date;
  }
}

module.exports = new ScrapingService();