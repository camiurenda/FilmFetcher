const axios = require('axios');
const pdf = require('pdf-parse');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

class PDFScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async scrapeFromPDF(pdfUrl, sitioId) {
    console.log(`Iniciando scraping desde PDF para el sitio ID: ${sitioId}`);
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      const pdfContent = await this.extractPDFContent(pdfUrl);
      const projections = await this.openAIScrapePDF(pdfContent);

      if (projections.length > 0) {
        console.log(`${projections.length} proyecciones extraídas del PDF para ${site.nombre}`);
        await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);

        const projectionsWithUniqueKey = projections.map(p => ({
          ...p,
          sitio: sitioId,
          nombreCine: site.nombre,
          claveUnica: `${p.nombrePelicula}-${p.fechaHora.toISOString()}-${sitioId}`
        }));

        return projectionsWithUniqueKey;
      } else {
        console.log(`No se encontraron proyecciones en el PDF para el sitio ${site.nombre}`);
        await this.updateSiteAndHistory(sitioId, 'exitoso', 'No se encontraron proyecciones', 0);
        return [];
      }
    } catch (error) {
      console.error(`Error al hacer scraping del PDF para el sitio ${sitioId}:`, error);
      await this.updateSiteAndHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  async extractPDFContent(pdfUrl) {
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const pdfBuffer = Buffer.from(response.data);
    const data = await pdf(pdfBuffer);
    return data.text;
  }

  async openAIScrapePDF(pdfContent) {
    console.log('Ejecutando análisis basado en OpenAI para el PDF');
    
    const prompt = `Analiza el siguiente contenido extraído de un PDF de una cartelera de cine o teatro y extrae información sobre las proyecciones de cine únicamente:

    ${pdfContent}

    Incluye el nombre de la película o evento, la fecha y hora, el director (si está disponible), el género, la duración, la sala y el precio. Devuelve la información en formato JSON siguiendo este esquema:
    {
      "proyecciones": [
        {
          "nombre": "string",
          "fechaHora": "string (formato ISO)",
          "director": "string",
          "genero": "string",
          "duracion": number,
          "sala": "string",
          "precio": number
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
              content: "Eres un experto en extraer información sobre proyecciones de cine y teatro desde PDFs. Tu tarea es analizar el contenido del PDF proporcionado y extraer información sobre las proyecciones o eventos. Devuelve SOLO el JSON sin ningún otro texto o formato adicional."
            },
            {
              role: "user",
              content: prompt
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

      let content = response.data.choices[0]?.message?.content.trim() || "{}";
      content = content.replace(/```json\n?|\n?```/g, '').trim();
      
      let aiResponse;
      try {
        aiResponse = JSON.parse(content);
      } catch (parseError) {
        console.error('Error al parsear la respuesta de OpenAI:', parseError);
        throw new Error(`No se pudo parsear la respuesta de OpenAI: ${parseError.message}`);
      }
      
      const proyecciones = aiResponse.proyecciones || aiResponse.Proyecciones;
      if (!Array.isArray(proyecciones)) {
        console.error('Respuesta de OpenAI no contiene proyecciones válidas:', aiResponse);
        throw new Error('Respuesta de OpenAI no contiene proyecciones válidas');
      }

      return this.processAIResponse(proyecciones);
    } catch (error) {
      console.error('Error en OpenAI scrape de PDF:', error);
      throw error;
    }
  }

  processAIResponse(proyecciones) {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    return proyecciones.map(p => {
      let fechaHora = new Date(p.fechaHora || p.FechaHora);
    
      if (fechaHora < new Date()) {
        fechaHora.setFullYear(nextYear);
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
        precio: parseFloat(p.precio || p.Precio) || 0
      };
    }).filter(p => p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    await Site.findByIdAndUpdate(siteId, {
      $set: { 'configuracionScraping.ultimoScrapingExitoso': new Date() },
      $push: { 'configuracionScraping.errores': { fecha: new Date(), mensaje: mensajeError } }
    });

    await ScrapingHistory.create({
      siteId,
      estado,
      mensajeError,
      cantidadProyecciones
    });
  }
}

module.exports = new PDFScrapingService();