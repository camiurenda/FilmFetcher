const Projection = require('../models/projection.model');
const OpenAI = require('openai');

class ChatbotService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async procesarMensaje(mensaje) {
    try {
      // Procesar el mensaje con GPT para entender la intención
      const intencion = await this.analizarIntencion(mensaje);

      // Generar respuesta basada en la intención
      let respuesta;
      switch (intencion) {
        case 'buscar_peliculas':
          respuesta = await this.buscarPeliculas(mensaje);
          break;
        case 'recomendar_pelicula':
          respuesta = await this.recomendarPelicula(mensaje);
          break;
        case 'informacion_pelicula':
          respuesta = await this.obtenerInformacionPelicula(mensaje);
          break;
        default:
          respuesta = "Lo siento, no entendí tu consulta. ¿Puedes reformularla?";
      }

      return respuesta;
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      return "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.";
    }
  }

  async analizarIntencion(mensaje) {
    const completion = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {role: "system", content: "Eres un asistente CHATBOT que analiza mensajes para determinar la intención del usuario respecto a consultas de cine. Las posibles intenciones son: buscar_peliculas, recomendar_pelicula, informacion_pelicula. No debes tocar otras temáticas que no sean esas."},
        {role: "user", content: mensaje}
      ],
    });
    return completion.choices[0].message.content.trim().toLowerCase();
  }

  async buscarPeliculas(mensaje) {
    // Lógica para buscar películas en la base de datos
    const peliculas = await Projection.find().limit(5);
    return `Algunas películas en cartelera son: ${peliculas.map(p => p.nombrePelicula).join(', ')}`;
  }

  async recomendarPelicula(mensaje) {
    // Lógica para recomendar una película basada en el mensaje
    const pelicula = await Projection.findOne().sort('-fechaHora');
    return `Te recomiendo ver "${pelicula.nombrePelicula}". Se proyecta en ${pelicula.nombreCine} el ${pelicula.fechaHora.toLocaleDateString()}.`;
  }

  async obtenerInformacionPelicula(mensaje) {
    const nombrePelicula = mensaje.replace("información sobre ", "").trim();
    const pelicula = await Projection.findOne({ nombrePelicula: new RegExp(nombrePelicula, 'i') });
    if (pelicula) {
      return `"${pelicula.nombrePelicula}" - Director: ${pelicula.director}, Género: ${pelicula.genero}, Duración: ${pelicula.duracion} minutos. Se proyecta en ${pelicula.nombreCine} el ${pelicula.fechaHora.toLocaleDateString()}.`;
    } else {
      return "Lo siento, no encontré información sobre esa película.";
    }
  }
}

module.exports = new ChatbotService();