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
        
        // Preparar proyecciones con datos adicionales
        const projectionsWithMetadata = projections.map(p => ({
          ...p,
          sitio: sitioId,
          nombreCine: site.nombre,
          claveUnica: `${p.nombrePelicula}-${p.fechaHora.toISOString()}-${sitioId}`,
          cargaManual: true,
          habilitado: true,
          fechaCreacion: new Date()
        }));

        // Guardar las proyecciones en la base de datos
        const savedProjections = await this.insertProjections(projectionsWithMetadata, site);
        console.log(`Se guardaron ${savedProjections.length} proyecciones en la base de datos`);

        // Actualizar historial
        await this.updateSiteAndHistory(sitioId, 'exitoso', null, savedProjections.length);

        return savedProjections;
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

  async insertProjections(projections, site) {
    const savedProjections = [];
    
    for (const projection of projections) {
      try {
        // Usar findOneAndUpdate con upsert para evitar duplicados
        const savedProjection = await Projection.findOneAndUpdate(
          { claveUnica: projection.claveUnica },
          { ...projection },
          { 
            upsert: true, 
            new: true, 
            setDefaultsOnInsert: true,
            runValidators: true 
          }
        );
        
        console.log(`Proyección guardada/actualizada: ${savedProjection.nombrePelicula}`);
        savedProjections.push(savedProjection);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Proyección duplicada ignorada: ${projection.nombrePelicula}`);
        } else {
          console.error('Error al guardar proyección:', error);
          throw error;
        }
      }
    }

    return savedProjections;
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
}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4-vision-preview",
          messages: [
            {
              role: "system",
              content: "Eres un experto en extraer información sobre proyecciones de cine desde imágenes."
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

      const content = response.data.choices[0]?.message?.content.trim() || "{}";
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      let aiResponse;
      try {
        aiResponse = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Error al parsear la respuesta de OpenAI:', parseError);
        throw new Error(`No se pudo parsear la respuesta de OpenAI: ${parseError.message}`);
      }
      
      const proyecciones = aiResponse.proyecciones || [];
      if (!Array.isArray(proyecciones)) {
        throw new Error('Respuesta de OpenAI no contiene un array de proyecciones válido');
      }

      return this.processAIResponse(proyecciones);
    } catch (error) {
      console.error('Error en OpenAI scrape de imagen:', error);
      throw error;
    }
  }

  processAIResponse(proyecciones) {
    const currentYear = new Date().getFullYear();
    
    return proyecciones
      .map(p => {
        try {
          const fechaHora = new Date(p.fechaHora || p.FechaHora);
          
          // Ajustar año si es necesario
          if (fechaHora.getFullYear() < currentYear) {
            fechaHora.setFullYear(currentYear);
          }

          return {
            nombrePelicula: p.nombre || p.Nombre || 'Sin título',
            fechaHora,
            director: p.director || p.Director || 'No especificado',
            genero: p.genero || p.Genero || 'No especificado',
            duracion: parseInt(p.duracion || p.Duracion) || 0,
            sala: p.sala || p.Sala || 'No especificada',
            precio: parseFloat(p.precio || p.Precio) || 0
          };
        } catch (error) {
          console.error('Error procesando proyección:', error);
          return null;
        }
      })
      .filter(p => 
        p !== null && 
        p.nombrePelicula && 
        p.fechaHora && 
        !isNaN(p.fechaHora.getTime())
      );
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    try {
      // Actualizar información del sitio
      await Site.findByIdAndUpdate(siteId, {
        $set: { 
          'ultimoScrapingExitoso': estado === 'exitoso' ? new Date() : undefined
        }
      });

      // Crear registro en el historial
      await ScrapingHistory.create({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones,
        fechaScraping: new Date()
      });
    } catch (error) {
      console.error('Error al actualizar historial:', error);
      // No lanzamos el error para no interrumpir el flujo principal
    }
  }
}

module.exports = new ImageScrapingService();