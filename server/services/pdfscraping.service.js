const axios = require('axios');
const pdf = require('pdf-parse');
const Site = require('../models/site.model');
const Projection = require('../models/projection.model');
const ScrapingHistory = require('../models/scrapingHistory.model');
require('dotenv').config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class PDFScrapingService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.MAX_RETRIES = 3;
    this.INITIAL_RETRY_DELAY = 1000;
    this.peliculasDetallesCache = new Map();
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
          console.log(`🎬 [TMDB] País de origen para ${nombrePelicula}: ${paisOrigen} (Argentina: ${esPeliculaArgentina ? 'Sí' : 'No'})`);
        }

        const detallesPelicula = {
          titulo: detalles.data.title,
          sinopsis: detalles.data.overview,
          generos: detalles.data.genres.map(g => g.name).join(', '),
          actores: actoresPrincipales,
          duracion: detalles.data.runtime || 0,
          puntuacion: detalles.data.vote_average.toFixed(1),
          paisOrigen,
          esPeliculaArgentina
        };

        this.peliculasDetallesCache.set(nombrePelicula, detallesPelicula);
        console.log(`✅ [TMDB] Detalles encontrados para: ${nombrePelicula}`);
        return detallesPelicula;
      }
      return null;
    } catch (error) {
      console.error(`❌ [TMDB] Error al obtener detalles:`, error);
      return null;
    }
  }

  async scrapeFromPDF(pdfUrl, sitioId) {
    console.log(`\n🎬 [PDF Scraping] INICIO SCRAPING DE PDF`);
    console.log(`📍 URL: ${pdfUrl}`);
    console.log(`🏢 ID Sitio: ${sitioId}`);

    let site;
    try {
      site = await Site.findById(sitioId);
      if (!site) {
        throw new Error('Sitio no encontrado');
      }
      console.log(`✅ [PDF Scraping] Sitio encontrado: ${site.nombre}`);

      const pdfContent = await this.extractPDFContent(pdfUrl);
      console.log(`📄 [PDF Scraping] Contenido PDF extraído: ${pdfContent.length} caracteres`);

      const projections = await this.openAIScrapePDF(pdfContent);

      if (projections && projections.length > 0) {
        console.log(`🎯 [PDF Scraping] ${projections.length} proyecciones extraídas para ${site.nombre}`);
        const processedProjections = await this.processAIResponse(projections, site);

        if (processedProjections.length > 0) {
          const preparedProjections = this.prepareProjectionsForDB(processedProjections, sitioId, site.nombre);
          const savedProjections = await this.saveProjections(preparedProjections);
          await this.updateSiteAndHistory(sitioId, 'exitoso', null, projections.length);

          console.log(`✨ [PDF Scraping] Proceso completado exitosamente`);
          console.log(`📊 Resumen:`);
          console.log(`   - Proyecciones extraídas: ${projections.length}`);
          console.log(`   - Proyecciones procesadas: ${processedProjections.length}`);
          console.log(`   - Proyecciones guardadas: ${savedProjections.length}`);

          return savedProjections;
        }
      }

      console.log(`⚠️ [PDF Scraping] No se encontraron proyecciones en el PDF para ${site.nombre}`);
      await this.updateSiteAndHistory(sitioId, 'exitoso', 'No se encontraron proyecciones', 0);
      return [];

    } catch (error) {
      const errorMessage = error.message || 'Error desconocido en el scraping de PDF';
      console.error(`❌ [PDF Scraping] Error:`, {
        sitio: site?.nombre || sitioId,
        error: errorMessage,
        stack: error.stack
      });
      await this.updateSiteAndHistory(sitioId, 'fallido', errorMessage, 0);
      throw error;
    }
  }

  async extractPDFContent(pdfUrl) {
    try {
      console.log('📥 [PDF Scraping] Descargando PDF desde:', pdfUrl);
      const response = await axios.get(pdfUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      console.log('🔄 [PDF Scraping] PDF descargado, procesando contenido...');
      const pdfBuffer = Buffer.from(response.data);
      const data = await pdf(pdfBuffer);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF vacío o sin contenido textual');
      }

      console.log(`📝 [PDF Scraping] Contenido extraído: ${data.text.length} caracteres`);
      return data.text;
    } catch (error) {
      console.error('❌ [PDF Scraping] Error extrayendo contenido:', error);
      throw new Error(`Error al procesar PDF: ${error.message}`);
    }
  }

  async openAIScrapePDF(pdfContent) {
    console.log('🧠 [PDF Scraping] Iniciando análisis con OpenAI...');

    const prompt = `     
        Analiza el siguiente texto y extrae las proyecciones de películas en un formato JSON, con la estructura especificada abajo. Utiliza el contexto proporcionado en el texto para determinar el mes y el año de las funciones, y completa las fechas de manera adecuada. Si algún dato no está presente (como género, duración o precio), deja el campo vacío o usa un valor por defecto.
        
        INSTRUCCIÓN IMPORTANTE: ANALIZA EL TEXTO Y DEVUELVE SOLO UN JSON VÁLIDO.

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

Si el PDF TIENE TITULO:
- Ayudate con el para saber a que MES corresponde

Compara las fechas declaradas con el calendario actual para saber si coinciden.

FORMATO JSON REQUERIDO:
{
  "proyecciones": [
    {
      "nombre": "string",
      "fechaHora": "2024-00-00-01T00:00:00.000Z",
      "director": "string",
      "genero": "string",
      "duracion": 0,
      "sala": "string",
      "precio": 0
    }
  ]
}

IMPORTANTE: SOLO JSON VÁLIDO, EN PROPERCASE SIN TEXTO ADICIONAL`;

    try {
      console.log('📤 [OpenAI] Enviando consulta a OpenAI');
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
      console.log('📥 [OpenAI] Respuesta recibida');

      content = this.preprocessOpenAIResponse(content);
      console.log('🔄 [OpenAI] Respuesta preprocesada');

      const validation = this.validateResponse(content);
      if (!validation.isValid) {
        throw new Error(`Respuesta inválida: ${validation.error}`);
      }

      console.log(`✅ [OpenAI] Respuesta válida con ${validation.data.proyecciones.length} proyecciones`);
      return validation.data.proyecciones;
    } catch (error) {
      console.error('❌ [OpenAI] Error:', error);
      throw new Error(`Error en procesamiento de OpenAI: ${error.message}`);
    }
  }

  async processAIResponse(proyecciones, site) {
    console.log(`🔄 [PDF Scraping] Procesando ${proyecciones.length} proyecciones para ${site.nombre}`);
    const processedProjections = [];
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    for (const p of proyecciones) {
      let retryCount = 0;
      while (retryCount < MAX_RETRIES) {
        try {
          const nombrePelicula = p.nombre || p.Nombre;
          let fechaHora = new Date(p.fechaHora || p.FechaHora);

          if (!nombrePelicula || !fechaHora || isNaN(fechaHora.getTime())) {
            console.log(`⚠️ Proyección inválida:`, {
              nombre: nombrePelicula,
              fecha: p.fechaHora || p.FechaHora
            });
            break;
          }

          // Ajuste crucial del año
          if (fechaHora < new Date()) {
            fechaHora.setFullYear(nextYear);
            console.log(`🔄 Ajustando año a ${nextYear} para ${nombrePelicula}`);
          } else {
            fechaHora.setFullYear(Math.max(fechaHora.getFullYear(), currentYear));
          }

          const detallesTMDB = await this.obtenerDetallesPelicula(nombrePelicula);
          let precio = site.esGratis ? 0 : (parseFloat(p.precio || p.Precio) || site.precioDefault || 0);

          const proyeccion = {
            nombrePelicula: detallesTMDB?.titulo || nombrePelicula,
            fechaHora: fechaHora,
            director: detallesTMDB?.director || p.director || p.Director || 'No especificado',
            genero: detallesTMDB?.generos || p.genero || p.Genero || 'No especificado',
            duracion: detallesTMDB?.duracion || parseInt(p.duracion || p.Duracion) || 0,
            sala: p.sala || p.Sala || 'No especificada',
            precio: precio,
            paisOrigen: detallesTMDB?.paisOrigen || 'No especificado',
            esPeliculaArgentina: detallesTMDB?.esPeliculaArgentina || false
          };

          console.log(`✅ Proyección procesada: ${nombrePelicula} - ${fechaHora.toISOString()}`);
          processedProjections.push(proyeccion);
          break;

        } catch (error) {
          console.error(`❌ Intento ${retryCount + 1}/${MAX_RETRIES} falló para ${p.nombre || p.Nombre}:`, error);
          retryCount++;
          
          if (retryCount < MAX_RETRIES) {
            console.log(`🔄 Esperando ${RETRY_DELAY}ms antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
          } else {
            console.error(`❌ Todos los intentos fallaron para ${p.nombre || p.Nombre}`);
          }
        }
      }
    }

    console.log(`📊 Total proyecciones procesadas: ${processedProjections.length}`);
    return processedProjections;
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

  prepareProjectionsForDB(projections, sitioId, nombreSitio) {
    console.log(`🔄 [PDF Scraping] Preparando ${projections.length} proyecciones para DB`);
    return projections.map(p => ({
      ...p,
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
      console.log(`📝 [PDF Scraping] Actualizando historial para sitio ${siteId}`);

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

      console.log(`✅ [PDF Scraping] Historial actualizado:`, {
        estado,
        proyecciones: cantidadProyecciones,
        error: mensajeError || 'Ninguno'
      });

    } catch (error) {
      console.error(`❌ [PDF Scraping] Error actualizando historial:`, error);
      throw error;
    }
  }
}

module.exports = new PDFScrapingService();