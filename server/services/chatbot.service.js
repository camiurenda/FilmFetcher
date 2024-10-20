const { OpenAI } = require('openai');
const Projection = require('../models/projection.model');
const Site = require('../models/site.model');

class ChatbotService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('ChatbotService: Inicializado con OpenAI');
  }

  async procesarMensaje(mensaje) {
    try {
      console.log('ChatbotService: Procesando mensaje:', mensaje);
      
      const peliculasActuales = await this.obtenerPeliculasActuales();
      console.log('Películas actuales obtenidas:', peliculasActuales.length);
      if (peliculasActuales.length > 0) {
        peliculasActuales.forEach(pelicula => {
          console.log(`Película: ${pelicula.nombrePelicula}, Cine: ${pelicula.nombreCine}, Fecha: ${pelicula.fechaHora}`);
        });
      } else {
        console.log('No se encontraron películas disponibles.');
      }

      const sitios = await this.obtenerSitios();
      console.log('Sitios obtenidos:', sitios.length);
      if (sitios.length > 0) {
        sitios.forEach(sitio => {
          console.log(`Sitio: ${sitio.nombre}`);
        });
      } else {
        console.log('No se encontraron sitios habilitados.');
      }

      const systemMessage = this.crearMensajeSistema(peliculasActuales, sitios);
      console.log('Mensaje del sistema creado:', systemMessage);

      console.log('Solicitando respuesta a OpenAI');
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Asegúrate de que este modelo sea correcto
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: mensaje }
        ],
        max_tokens: 2000
      });

      console.log('Respuesta de OpenAI recibida:', completion);
      const respuesta = completion.choices[0].message.content;
      console.log('Respuesta generada:', respuesta);

      return respuesta;

    } catch (error) {
      console.error('Error al procesar mensaje en ChatbotService:', error);
      if (error.response) {
        console.error('Detalles del error de OpenAI:', error.response.data);
      }
      return "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.";
    }
  }

  async obtenerPeliculasActuales() {
    console.log('Obteniendo películas actuales...');
    const fechaActual = new Date();
    
    try {
      const peliculas = await Projection.find({
        habilitado: true,
        fechaHora: { $gte: fechaActual }
      })
      .sort({ fechaHora: 1 })
      .limit(20)
      .maxTimeMS(60000);
      
      console.log(`Películas encontradas: ${peliculas.length}`);
      return peliculas;
    } catch (error) {
      console.error('Error en la consulta a MongoDB (timeout o fallo):', error.message);
      throw error;
    }
  }
  

  async obtenerSitios() {
    console.log('Obteniendo sitios habilitados...');
    try {
      const sitios = await Site.find({ habilitado: true });
      console.log(`Sitios encontrados: ${sitios.length}`);
      return sitios;
    } catch (error) {
      console.error('Error al obtener sitios:', error);
      throw error;
    }
  }

  crearMensajeSistema(peliculas, sitios) {
    console.log('Creando mensaje del sistema...');
    const peliculasInfo = peliculas.map(p =>
      `"${p.nombrePelicula}" en ${p.nombreCine} el ${p.fechaHora.toLocaleDateString()} a las ${p.fechaHora.toLocaleTimeString()}`
    ).join(', ');

    const sitiosInfo = sitios.map(s => s.nombre).join(', ');

    const mensajeSistema = `Eres un asistente de cine amigable y cinéfilo. Tu tarea es ayudar a los usuarios a encontrar información sobre películas y cines.
    Actualmente, estas son las películas en cartelera: ${peliculasInfo}.
    Los cines disponibles son: ${sitiosInfo}.
    Responde de manera amable y concisa a las preguntas de los usuarios sobre estas películas, cines, horarios o cualquier otra consulta relacionada con el cine.
    Si te preguntan por una película que no está en la lista, puedes sugerir alguna de las que sí están disponibles. Redirige amablemente preguntas que se vayan de la temática de la cartelera. Por último, si quieres poner texto en negritas, se pone con un solo asterisco y no con 2.`;

    console.log('Mensaje del sistema generado:', mensajeSistema);
    return mensajeSistema;
  }
}

module.exports = new ChatbotService();
