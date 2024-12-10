const axios = require('axios');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class ImageScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.MAX_RETRIES = 3;
    this.INITIAL_RETRY_DELAY = 1000;
    this.peliculasDetallesCache = new Map();
  }

  async scrapeFromImage(imageUrl, sitioId, onProgress) {
    console.log(`Iniciando scraping desde imagen para el sitio ID: ${sitioId}`);
    try {
      onProgress?.({
        currentStep: 0,
        status: { initialization: { detail: 'Validando imagen y sitio...' } }
      });

      const site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }

      onProgress?.({
        currentStep: 1,
        status: { extraction: { detail: 'Extrayendo contenido de la imagen...' } }
      });

      let lastError;
      let projections;

      for (let intento = 1; intento <= this.MAX_RETRIES; intento++) {
        try {
          projections = await this.openAIScrapeImage(imageUrl);

          if (projections && projections.length > 0) {
            console.log(`Intento ${intento}: ${projections.length} proyecciones extraídas`);

            onProgress?.({
              currentStep: 2,
              status: { aiProcessing: { detail: 'Analizando contenido con OpenAI...' } }
            });

            onProgress?.({
              currentStep: 3,
              status: { enrichment: { detail: 'Buscando información adicional...' } },
              stats: { total: projections.length, processed: 0 }
            });

            const processedProjections = await this.processAIResponse(projections, site, (processed) => {
              onProgress?.({
                currentStep: 3,
                status: { enrichment: { detail: 'Buscando información adicional...' } },
                stats: { total: projections.length, processed }
              });
            });

            if (processedProjections.length > 0) {
              onProgress?.({
                currentStep: 4,
                status: { storage: { detail: 'Guardando proyecciones...' } }
              });

              const preparedProjections = this.prepareProjectionsForDB(processedProjections, sitioId, site.nombre);
              await this.saveProjections(preparedProjections);
              await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);
              return preparedProjections;
            }
            break;
          }
        } catch (error) {
          lastError = error;
          console.warn(`Intento ${intento} fallido:`, error.message);

          if (intento < this.MAX_RETRIES) {
            const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, intento - 1);
            console.log(`Esperando ${delay}ms antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            onProgress?.({
              currentStep: 1,
              status: {
                extraction: {
                  detail: `Reintentando extracción (${intento + 1}/${this.MAX_RETRIES})...`
                }
              }
            });
          }
        }
      }

      if (!projections || projections.length === 0) {
        console.log('No se encontraron proyecciones válidas');
        await this.updateSiteAndHistory(sitioId, 'exitoso', 'No se encontraron proyecciones', 0);
        return [];
      }

        } catch (error) {
      console.error('Error en scrapeFromImage:', error);
      await this.updateSiteAndHistory(sitioId, 'fallido', error.message, 0);
      throw error;
    }
  }

  async openAIScrapeImage(imageUrl) {
    console.log('Ejecutando análisis basado en OpenAI para la imagen');

    const prompt = `Analiza la imagen de cartelera y extrae los datos en formato JSON estructurado.
    CONTEXTO:
    
    Asume año actual (2024) salvo indicación contraria
    Para rangos de fechas, genera una entrada por cada día
    Usa "No especificado" para texto faltante y 0 para números faltantes
    Los títulos de películas deben estar en Propercase
    
    ESTRUCTURA REQUERIDA:
    {
    "proyecciones": [
    {
    "nombre": "Título De La Película",
    "fechaHora": "2024-MM-DDTHH:mm:ss.sssZ",
    "director": "Nombre Del Director",
    "genero": "Géneros Separados Por Comas",
    "duracion": 120,
    "sala": "Identificador De Sala",
    "precio": 2500.00
    }
    ]
    }
    REGLAS DE PROCESAMIENTO:
    
    FECHAS
    
    Convierte todo a ISO 8601
    Expande rangos de fechas a entradas individuales
    Normaliza formatos parciales (ej: "15/11" → "2024-11-15")
    
    
    PRECIOS
    
    Convierte a número decimal
    Incluye centavos si están especificados
    Sin símbolo de moneda
    
    
    TEXTO
    
    Normaliza espacios
    Elimina caracteres especiales
    Capitaliza Nombres Propios
    
    
    
    RETORNA ÚNICAMENTE EL JSON, SIN TEXTO ADICIONAL.`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Eres un experto en extraer información de cine desde imágenes. SOLO devuelves JSON válido, sin texto adicional."
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

  async obtenerDetallesPelicula(nombrePelicula) {
    if (this.peliculasDetallesCache.has(nombrePelicula)) {
      return this.peliculasDetallesCache.get(nombrePelicula);
    }

    try {
      console.log(`🎬 [TMDB] Buscando detalles para: ${nombrePelicula}`);
      const searchResponse = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
        params: {
          api_key: TMDB_API_KEY,
          query: nombrePelicula,
          language: 'es-ES'
        }
      });

      if (searchResponse.data.results.length > 0) {
        const peliculaId = searchResponse.data.results[0].id;
        const [detalles, creditos] = await Promise.all([
          axios.get(`${TMDB_BASE_URL}/movie/${peliculaId}`, {
            params: {
              api_key: TMDB_API_KEY,
              language: 'es-ES'
            }
          }),
          axios.get(`${TMDB_BASE_URL}/movie/${peliculaId}/credits`, {
            params: {
              api_key: TMDB_API_KEY
            }
          })
        ]);

        const actoresPrincipales = creditos.data.cast
          .slice(0, 3)
          .map(actor => actor.name)
          .join(', ');

        let paisOrigen = 'No especificado';
        let esPeliculaArgentina = false;

        if (detalles.data.production_countries && detalles.data.production_countries.length > 0) {
          paisOrigen = detalles.data.production_countries[0].iso_3166_1;
          esPeliculaArgentina = paisOrigen === 'AR';
        }

        const detallesPelicula = {
          titulo: detalles.data.title,
          sinopsis: detalles.data.overview,
          generos: detalles.data.genres.map(g => g.name).join(', '),
          actores: actoresPrincipales,
          director: this.obtenerDirector(creditos.data.crew),
          duracion: detalles.data.runtime || 0,
          puntuacion: detalles.data.vote_average.toFixed(1),
          paisOrigen,
          esPeliculaArgentina
        };

        this.peliculasDetallesCache.set(nombrePelicula, detallesPelicula);
        return detallesPelicula;
      }
      return null;
    } catch (error) {
      console.error('Error al obtener detalles de TMDB:', error);
      return null;
    }
  }

  obtenerDirector(crew) {
    const director = crew.find(member => member.job === 'Director');
    return director ? director.name : 'No especificado';
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

  async processAIResponse(proyecciones, site, onProgress) {
    const processedProjections = [];
    let processed = 0;

    for (const p of proyecciones) {
      try {
        const nombrePelicula = p.nombre || p.Nombre;
        const fechaHora = new Date(p.fechaHora || p.FechaHora);

        if (!nombrePelicula || !fechaHora || isNaN(fechaHora.getTime())) {
          console.log(`⚠️ Proyección inválida:`, {
            nombre: nombrePelicula,
            fecha: p.fechaHora || p.FechaHora
          });
          continue;
        }

        const detallesTMDB = await this.obtenerDetallesPelicula(nombrePelicula);

        const projection = {
          nombrePelicula: detallesTMDB?.titulo || nombrePelicula,
          fechaHora,
          director: detallesTMDB?.director || p.director || p.Director || 'No especificado',
          genero: detallesTMDB?.generos || p.genero || p.Genero || 'No especificado',
          duracion: detallesTMDB?.duracion || parseInt(p.duracion || p.Duracion) || 0,
          sala: p.sala || p.Sala || 'No especificada',
          precio: site.esGratis ? 0 : (parseFloat(p.precio || p.Precio) || site.precioDefault || 0),
          paisOrigen: detallesTMDB?.paisOrigen || 'No especificado',
          esPeliculaArgentina: detallesTMDB?.esPeliculaArgentina || false
        };

        processed++;
        onProgress?.(processed);
        processedProjections.push(projection);
      } catch (error) {
        console.error('Error procesando proyección:', error);
      }
    }

    return processedProjections;
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
    console.log(`💾 [PDF Scraping] Guardando ${projections.length} proyecciones en DB`);
    const results = [];
    let exitosas = 0;
    let duplicadas = 0;
    let errores = 0;

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
        exitosas++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`ℹ️ [PDF Scraping] Proyección duplicada: ${projection.nombrePelicula}`);
          duplicadas++;
        } else {
          console.error(`❌ [PDF Scraping] Error guardando proyección:`, error);
          errores++;
        }
      }
    }

    console.log(`📊 [PDF Scraping] Resumen de guardado:
        - Exitosas: ${exitosas}
        - Duplicadas: ${duplicadas}
        - Errores: ${errores}`);

    return results;
  }

  async updateSiteAndHistory(siteId, estado, mensajeError, cantidadProyecciones) {
    try {
      console.log(`📝 [Image Scraping] Actualizando historial para sitio ${siteId}`);

      await Site.findByIdAndUpdate(siteId, {
        $set: {
          ultimoScrapingExitoso: estado === 'exitoso' ? new Date() : undefined
        }
      });

      const historialEntry = await ScrapingHistory.create({
        siteId,
        estado,
        mensajeError,
        cantidadProyecciones,
        fechaScraping: new Date()
      });

      console.log(`✅ [Image Scraping] Historial actualizado:`, {
        estado,
        proyecciones: cantidadProyecciones,
        error: mensajeError || 'Ninguno'
      });

    } catch (error) {
      console.error(`❌ [Image Scraping] Error actualizando historial:`, error);
      throw error;
    }
  }
}

module.exports = new ImageScrapingService();