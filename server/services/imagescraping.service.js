const axios = require('axios');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

class ImageScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.MAX_RETRIES = 3;
    this.INITIAL_RETRY_DELAY = 1000;
  }

  async scrapeFromImage(imageUrl, sitioId) {
    console.log(`Iniciando scraping desde imagen para el sitio ID: ${sitioId}`);
    try {
      // Validamos el sitio una sola vez al inicio
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      // Implementar reintentos con backoff exponencial
      let lastError;
      for (let intento = 1; intento <= this.MAX_RETRIES; intento++) {
        try {
          const projections = await this.openAIScrapeImage(imageUrl);
          
          if (projections && projections.length > 0) {
            console.log(`Intento ${intento}: ${projections.length} proyecciones extraídas`);
            // Pasamos el objeto site completo en lugar del ID
            const processedProjections = await this.processAIResponse(projections, site);
            if (processedProjections.length > 0) {
              const preparedProjections = this.prepareProjectionsForDB(processedProjections, sitioId, site.nombre);
              await this.saveProjections(preparedProjections);
              await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);
              return preparedProjections;
            }
          }
        } catch (error) {
          lastError = error;
          console.warn(`Intento ${intento} fallido:`, error.message);
          
          if (intento < this.MAX_RETRIES) {
            const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, intento - 1);
            console.log(`Esperando ${delay}ms antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      // Si llegamos aquí, todos los intentos fallaron
      console.error('Todos los intentos de scraping fallaron');
      await this.updateSiteAndHistory(sitioId, 'fallido', lastError?.message, 0);
      throw lastError;
    } catch (error) {
      console.error('Error en scrapeFromImage:', error);
      await this.updateSiteAndHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  async openAIScrapeImage(imageUrl) {
    console.log('Iniciando análisis de imagen con OpenAI...');
    
    const prompt = `INSTRUCCIÓN IMPORTANTE: ANALIZA LA IMAGEN Y DEVUELVE SOLO UN JSON VÁLIDO.

Para cada película en la cartelera, extrae:
1. Nombre exacto
2. Fecha y hora en formato ISO (YYYY-MM-DDTHH:mm:ss.sssZ)
3. Director si está disponible
4. Género si está disponible
5. Duración en minutos
6. Sala
7. Precio

Si un campo no está disponible:
- Usar "No especificado" para strings
- Usar 0 para números

Si la imagen indica un rango de fechas (ej: "válido del 20/11 al 27/11"):
- Genera una entrada por cada día del período para cada película y horario
- Usa el año actual (2024) si no se especifica

FORMATO JSON REQUERIDO:
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

IMPORTANTE:
- RESPONDE SOLO CON EL JSON, SIN TEXTO ADICIONAL
- CADA OBJETO DEBE TENER EXACTAMENTE LOS CAMPOS ESPECIFICADOS
- USA VALORES POR DEFECTO SI NO HAY INFORMACIÓN`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un sistema que SOLO devuelve JSON válido, sin texto adicional. Siempre verifica la validez del JSON antes de responder."
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: 8000,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      let content = response.data.choices[0]?.message?.content.trim() || "{}";
      console.log('Respuesta de OpenAI:', content.substring(0, 200) + '...');
      
      content = this.preprocessOpenAIResponse(content);
      console.log('Respuesta preprocesada:', content.substring(0, 200) + '...');
      
      const validation = this.validateResponse(content);
      if (!validation.isValid) {
        throw new Error(`Respuesta inválida: ${validation.error}`);
      }

      return validation.data.proyecciones;
    } catch (error) {
      console.error('Error en OpenAI scrape:', error);
      throw error;
    }
  }

  preprocessOpenAIResponse(content) {
    try {
      const startIndex = content.indexOf('{');
      if (startIndex === -1) throw new Error('No se encontró JSON válido');
      content = content.substring(startIndex);
      
      const endIndex = content.lastIndexOf('}');
      if (endIndex === -1) throw new Error('No se encontró JSON válido');
      content = content.substring(0, endIndex + 1);
      
      content = content
        .replace(/\s+/g, ' ')
        .replace(/'/g, '"')
        .replace(/[\u2018\u2019]/g, '"')
        .trim();
      
      return content;
    } catch (error) {
      console.error('Error en preprocessOpenAIResponse:', error);
      throw new Error(`Error al preprocesar la respuesta: ${error.message}`);
    }
  }

  validateResponse(content) {
    try {
      const parsedData = JSON.parse(content);

      if (!parsedData.proyecciones) {
        return { isValid: false, error: 'Falta el campo proyecciones' };
      }

      if (!Array.isArray(parsedData.proyecciones)) {
        return { isValid: false, error: 'proyecciones no es un array' };
      }

      const camposRequeridos = ['nombre', 'fechaHora', 'director', 'genero', 'duracion', 'sala', 'precio'];
      
      for (let i = 0; i < parsedData.proyecciones.length; i++) {
        const proj = parsedData.proyecciones[i];
        
        for (const campo of camposRequeridos) {
          if (!proj.hasOwnProperty(campo)) {
            return { 
              isValid: false, 
              error: `Falta el campo ${campo} en la proyección ${i + 1}` 
            };
          }
        }

        if (typeof proj.nombre !== 'string' || 
            typeof proj.director !== 'string' || 
            typeof proj.genero !== 'string' || 
            typeof proj.sala !== 'string') {
          return { 
            isValid: false, 
            error: `Tipos de datos incorrectos en la proyección ${i + 1}` 
          };
        }

        if (!Date.parse(proj.fechaHora)) {
          return { 
            isValid: false, 
            error: `Fecha inválida en la proyección ${i + 1}: ${proj.fechaHora}` 
          };
        }
      }

      return { isValid: true, data: parsedData };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Error al parsear JSON: ${error.message}` 
      };
    }
  }

  // Modificado para recibir el objeto site en lugar del sitioId
  async processAIResponse(proyecciones, site) {
    return proyecciones.map(p => {
      let precio = 0;
      if (site.esGratis) {
        precio = 0;
      } else {
        precio = parseFloat(p.precio || p.Precio) || site.precioDefault || null;
      }

      return {
        nombrePelicula: p.nombre || p.Nombre || 'Sin título',
        fechaHora: new Date(p.fechaHora || p.FechaHora),
        director: p.director || p.Director || 'No especificado',
        genero: p.genero || p.Genero || 'No especificado',
        duracion: parseInt(p.duracion || p.Duracion) || 0,
        sala: p.sala || p.Sala || 'No especificada',
        precio: precio
      };
    }).filter(p => p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
  }
  
  prepareProjectionsForDB(projections, sitioId, nombreSitio) {
    return projections.map(p => ({
      nombrePelicula: p.nombrePelicula,
      fechaHora: p.fechaHora,
      director: p.director,
      genero: p.genero,
      duracion: p.duracion,
      sala: p.sala,
      precio: p.precio,
      sitio: sitioId,
      nombreCine: nombreSitio,
      claveUnica: `${p.nombrePelicula}-${p.fechaHora.toISOString()}-${sitioId}`,
      cargaManual: true,
      habilitado: true,
      fechaCreacion: new Date()
    }));
  }

  async saveProjections(projections) {
    const results = [];
    for (const projection of projections) {
      try {
        const savedProj = await Projection.findOneAndUpdate(
          { claveUnica: projection.claveUnica },
          projection,
          { 
            upsert: true, 
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true 
          }
        );
        results.push(savedProj);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Proyección duplicada ignorada: ${projection.nombrePelicula}`);
        } else {
          throw error;
        }
      }
    }
    return results;
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    try {
      const historialEntry = await ScrapingHistory.create({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones,
        fechaScraping: new Date()
      });

      await Site.findByIdAndUpdate(siteId, {
        $set: { 
          ultimoScrapingExitoso: estado === 'exitoso' ? new Date() : undefined
        }
      });

      console.log('Historial actualizado:', historialEntry);
    } catch (error) {
      console.error('Error al actualizar historial:', error);
    }
  }
}

module.exports = new ImageScrapingService();