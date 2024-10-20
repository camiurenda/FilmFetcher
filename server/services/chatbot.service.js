const { OpenAI } = require('openai');
const Projection = require('../models/projection.model');
const Site = require('../models/site.model');

class ChatbotService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async procesarMensaje(mensaje) {
    try {
      console.log('ChatbotService: Procesando mensaje:', mensaje);
      const peliculasActuales = await this.obtenerPeliculasActuales();
      console.log('Películas actuales obtenidas:', peliculasActuales.length);
      const sitios = await this.obtenerSitios();
      console.log('Sitios obtenidos:', sitios.length);
      const systemMessage = this.crearMensajeSistema(peliculasActuales, sitios);
      console.log('Mensaje del sistema creado');

      console.log('Solicitando respuesta a OpenAI');
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Asegúrate de que este modelo sea correcto
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: mensaje }
        ],
        max_tokens: 2000
      });

      console.log('Respuesta de OpenAI recibida');
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
    const fechaActual = new Date();
    return await Projection.find({
      habilitado: true,
      fechaHora: { $gte: fechaActual }
    }).sort({ fechaHora: 1 }).limit(20);
  }

  async obtenerSitios() {
    return await Site.find({ habilitado: true });
  }

  crearMensajeSistema(peliculas, sitios) {
    const peliculasInfo = peliculas.map(p =>
      `"${p.nombrePelicula}" en ${p.nombreCine} el ${p.fechaHora.toLocaleDateString()} a las ${p.fechaHora.toLocaleTimeString()}`
    ).join(', ');

    const sitiosInfo = sitios.map(s => s.nombre).join(', ');

    return `Eres un asistente de cine amigable y cinéfilo. Tu tarea es ayudar a los usuarios a encontrar información sobre películas y cines.
    Actualmente, estas son las películas en cartelera: ${peliculasInfo}.
    Los cines disponibles son: ${sitiosInfo}.
    Responde de manera amable y concisa a las preguntas de los usuarios sobre estas películas, cines, horarios o cualquier otra consulta relacionada con el cine.
    Si te preguntan por una película que no está en la lista, puedes sugerir alguna de las que sí están disponibles. Redirige amablemente preguntas que se vayan de la temática de la cartelera. Por último, si quieres poner texto en negritas, se pone con un solo asterisco y no con 2.`;
  }
}

module.exports = new ChatbotService();