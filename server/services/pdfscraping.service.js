const axios = require('axios');
const pdf = require('pdf-parse');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

/**
 * Servicio para extraer y procesar información de carteleras desde archivos PDF
 */
class PDFScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.MAX_RETRIES = 3;
    this.INITIAL_RETRY_DELAY = 1000;
  }

  /**
   * Método principal para procesar un PDF y extraer proyecciones
   */
  async scrapeFromPDF(pdfUrl, sitioId) {
    console.log(`Iniciando scraping desde PDF para el sitio ID: ${sitioId}`);
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      // Implementar reintentos con backoff exponencial
      let lastError;
      for (let intento = 1; intento <= this.MAX_RETRIES; intento++) {
        try {
          const pdfContent = await this.extractPDFContent(pdfUrl);
          const projections = await this.openAIScrapePDF(pdfContent);
          
          if (projections && projections.length > 0) {
            console.log(`Intento ${intento}: ${projections.length} proyecciones extraídas`);
            const preparedProjections = this.prepareProjectionsForDB(projections, sitioId, site.nombre);
            const savedProjections = await this.saveProjections(preparedProjections);
            await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);
            return savedProjections;
          } else {
            console.log('No se encontraron proyecciones en el contenido del PDF');
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
      console.error('Error en scrapeFromPDF:', error);
      await this.updateSiteAndHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  /**
   * Extrae el contenido de texto del PDF
   */
  async extractPDFContent(pdfUrl) {
    try {
      console.log('Descargando PDF desde:', pdfUrl);
      const response = await axios.get(pdfUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      
      console.log('PDF descargado, procesando contenido...');
      const pdfBuffer = Buffer.from(response.data);
      const data = await pdf(pdfBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF vacío o sin contenido textual');
      }
      
      return data.text;
    } catch (error) {
      console.error('Error al extraer contenido del PDF:', error);
      throw new Error(`Error al procesar PDF: ${error.message}`);
    }
  }

  /**
   * Procesa el PDF usando OpenAI
   */
  async openAIScrapePDF(pdfContent) {
    console.log('Iniciando análisis de PDF con OpenAI...');
    
    const prompt = `INSTRUCCIÓN IMPORTANTE: ANALIZA EL TEXTO Y DEVUELVE SOLO UN JSON VÁLIDO.

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

Si el PDF indica un rango de fechas:
- Genera una entrada por cada día del período para cada película
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

IMPORTANTE: SOLO JSON VÁLIDO, SIN TEXTO ADICIONAL`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un sistema experto en extraer información estructurada de PDFs de carteleras de cine. SOLO devuelves JSON válido, sin texto adicional."
            },
            {
              role: "user",
              content: prompt + "\n\nContenido del PDF:\n" + pdfContent
            }
          ],
          max_tokens: 10000,
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
      
      const validation = this.validateResponse(content);
      if (!validation.isValid) {
        throw new Error(`Respuesta inválida: ${validation.error}`);
      }

      return this.processAIResponse(validation.data.proyecciones);
    } catch (error) {
      console.error('Error en OpenAI scrape:', error);
      throw new Error(`Error en procesamiento de OpenAI: ${error.message}`);
    }
  }

  /**
   * Limpia y formatea la respuesta de OpenAI
   */
  preprocessOpenAIResponse(content) {
    try {
      // Eliminar cualquier texto antes del primer '{'
      const startIndex = content.indexOf('{');
      if (startIndex === -1) throw new Error('No se encontró JSON válido');
      content = content.substring(startIndex);
      
      // Eliminar cualquier texto después del último '}'
      const endIndex = content.lastIndexOf('}');
      if (endIndex === -1) throw new Error('No se encontró JSON válido');
      content = content.substring(0, endIndex + 1);
      
      // Limpiar el contenido
      content = content
        .replace(/\s+/g, ' ')
        .replace(/'/g, '"')
        .replace(/[\u2018\u2019]/g, '"')
        .trim();
      
      return content;
    } catch (error) {
      throw new Error(`Error al preprocesar la respuesta: ${error.message}`);
    }
  }

  /**
   * Valida la estructura y contenido de la respuesta
   */
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

  async processAIResponse(proyecciones, sitioId) {
    const currentYear = new Date().getFullYear();
    
    try {
      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      return proyecciones
        .map(p => {
          try {
            let fechaHora = new Date(p.fechaHora || p.FechaHora);
            
            if (isNaN(fechaHora.getTime())) {
              console.error('Fecha inválida detectada:', p.fechaHora);
              return null;
            }

            if (fechaHora.getFullYear() < currentYear) {
              fechaHora.setFullYear(currentYear);
            }

            let precio = 0;
            if (site.esGratis) {
              precio = 0;
            } else {
              precio = parseFloat(p.precio || p.Precio) || site.precioDefault || null;
            }

            return {
              nombrePelicula: p.nombre || p.Nombre || 'Sin título',
              fechaHora: fechaHora,
              director: p.director || p.Director || 'No especificado',
              genero: p.genero || p.Genero || 'No especificado',
              duracion: parseInt(p.duracion || p.Duracion) || 0,
              sala: p.sala || p.Sala || 'No especificada',
              precio: precio
            };
          } catch (error) {
            console.error('Error procesando proyección:', error);
            return null;
          }
        })
        .filter(p => p !== null && p.nombrePelicula && p.fechaHora && !isNaN(p.fechaHora.getTime()));
    } catch (error) {
      console.error('Error al procesar respuesta del PDF:', error);
      return [];
    }
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

  /**
   * Guarda las proyecciones en la base de datos
   */
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

  /**
   * Actualiza el historial de scraping
   */
  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    try {
      await ScrapingHistory.create({
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
    } catch (error) {
      console.error('Error al actualizar historial:', error);
      throw error;
    }
  }
}

module.exports = new PDFScrapingService();