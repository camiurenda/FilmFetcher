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
    
    const prompt = `Analiza la siguiente imagen de una cartelera de cine y extrae información sobre las proyecciones:

REGLAS DE INTERPRETACIÓN:
1. Si la imagen indica "Programación válida desde [fecha1] al [fecha2]":
   - Cada película se proyecta TODOS LOS DÍAS en ese período
   - Por cada horario mostrado, debes generar una proyección para cada día del período
   - Usa el año actual (2024) salvo que se especifique otro año

2. Para cada película, debes procesar:
   - Nombre exactamente como aparece
   - Todos los horarios listados
   - La sala asignada a cada horario
   - La duración en minutos (si se especifica)
   - El precio según la información general de precios
   - SAM o clasificación si está disponible

3. Formato de fechas:
   - Genera una proyección por día del período para cada horario
   - Usa el formato ISO 8601 para las fechas (YYYY-MM-DDTHH:mm:ss.sssZ)
   - Respeta exactamente los horarios mostrados

Devuelve un JSON con este esquema EXACTO:
{
  "proyecciones": [
    {
      "nombre": "string",
      "fechaHora": "string (ISO8601)",
      "director": "string",
      "genero": "string",
      "duracion": number,
      "sala": "string",
      "precio": number
    }
  ]
}

IMPORTANTE:
- Si una película tiene 3 horarios y el período es de 7 días, deberás generar 21 proyecciones
- Usa el precio más alto si hay diferentes precios según el día
- Si falta información, usa "No especificado" para strings y 0 para números
- Devuelve SOLO el JSON, sin texto adicional ni marcadores de código`
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
          max_tokens: 8000
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