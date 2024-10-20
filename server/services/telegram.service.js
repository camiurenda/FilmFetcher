const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    this.apiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  }

  async handleUpdate(update) {
    console.log('TelegramService.handleUpdate: Iniciando procesamiento de actualización');
    try {
      console.log('Procesando actualización de Telegram:', JSON.stringify(update));
      const message = update.message;
      if (message && message.text && message.from && !message.from.is_bot) {
        const chatId = message.chat.id;
        console.log(`Mensaje recibido de chatId: ${chatId}, texto: "${message.text}"`);

        let respuesta;
        if (message.text === '/start') {
          respuesta = '¡Bienvenido a FilmFetcher Bot! Estoy aquí para ayudarte con información sobre películas y cines. ¿Qué te gustaría saber?';
        } else {
          console.log('Solicitando respuesta a ChatbotService');
          respuesta = await ChatbotService.procesarMensaje(message.text);
        }

        console.log(`Respuesta generada: "${respuesta}"`);
        console.log(`Intentando enviar respuesta a ${chatId}`);
        
        try {
          console.log('Iniciando solicitud a la API de Telegram');
          const response = await axios.post(`${this.apiUrl}/sendMessage`, {
            chat_id: chatId,
            text: respuesta
          });
          console.log('Respuesta de la API de Telegram:', JSON.stringify(response.data));
          if (response.data.ok) {
            console.log('Mensaje enviado con éxito');
          } else {
            console.error('Error al enviar mensaje:', response.data.description);
          }
        } catch (sendError) {
          console.error('Error al enviar mensaje:', sendError.message);
          if (sendError.response) {
            console.error('Detalles del error:', JSON.stringify(sendError.response.data));
          }
          throw sendError;
        }
      } else {
        console.log('Mensaje ignorado: no es de un usuario o no contiene texto');
      }
    } catch (error) {
      console.error('Error procesando actualización de Telegram:', error.message);
      try {
        await axios.post(`${this.apiUrl}/sendMessage`, {
          chat_id: update.message.chat.id,
          text: "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde."
        });
        console.log('Mensaje de error enviado');
      } catch (sendError) {
        console.error('Error al enviar mensaje de error:', sendError.message);
      }
    }
    console.log('TelegramService.handleUpdate: Finalizando procesamiento de actualización');
  }
}

module.exports = new TelegramService();