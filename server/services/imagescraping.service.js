const axios = require('axios');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

class ImageScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async scrapeFromImage(imageUrl, sitioId) {
    console.log(`Iniciando scraping desde imagen para el sitio ID: ${sitioId}`);
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      const projections = await this.openAIScrapeImage(imageUrl);

      if (projections.length > 0) {
        console.log(`${projections.length} proyecciones extraídas de la imagen para ${site.nombre}`);
        await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);

        // Añadir claveUnica y nombreCine a cada proyección
        const projectionsWithUniqueKey = projections.map(p => ({
          ...p,
          sitio: sitioId,
          nombreCine: site.nombre,
          claveUnica: `${p.nombrePelicula}-${p.fechaHora.toISOString()}-${sitioId}`
        }));

        return projectionsWithUniqueKey;
      } else {
        console.log(`No se encontraron proyecciones en la imagen para el sitio ${site.nombre}`);
        await this.updateSiteAndHistory(sitioId, 'exitoso', 'No se encontraron proyecciones', 0);
        return [];
      }
    } catch (error) {
      console.error(`Error al hacer scraping de la imagen para el sitio ${sitioId}:`, error);
      await this.updateSiteAndHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  async openAIScrapeImage(imageUrl) {
    console.log('Ejecutando análisis basado en OpenAI para la imagen');
    
    const prompt = `Analiza la siguiente imagen de una cartelera de cine o teatro y extrae información sobre las proyecciones de cine unicamente:

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
    Si no encuentras nada, devuelve un array vacío. Asume que la funcion es en el año actual (2024) salvo que se exprese lo contrario. Devuelve SOLO el JSON con los datos en propercase, sin ningún otro texto o formato adicional.`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un experto en extraer información sobre proyecciones de cine y teatro desde imágenes. Tu tarea es analizar la imagen proporcionada y extraer información sobre las proyecciones o eventos. Devuelve SOLO el JSON sin ningún otro texto o formato adicional."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
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
      console.error('Error en OpenAI scrape de imagen:', error);
      throw error;
    }
  }

  processAIResponse(proyecciones) {
    return proyecciones.map(p => ({
      nombrePelicula: p.nombre || p.Nombre,
      fechaHora: new Date(p.fechaHora || p.FechaHora),
      director: p.director || p.Director || 'No especificado',
      genero: p.genero || p.Genero || 'No especificado',
      duracion: parseInt(p.duracion || p.Duracion) || 0,
      sala: p.sala || p.Sala || 'No especificada',
      precio: parseFloat(p.precio || p.Precio) || 0
    })).filter(p => p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
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

module.exports = new ImageScrapingService();