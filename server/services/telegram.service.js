const TelegramBot = require('node-telegram-bot-api');
const ChatbotService = require('./chatbot.service');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
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
          const sentMessage = await this.bot.sendMessage(chatId, respuesta);
          console.log('Respuesta enviada con éxito:', JSON.stringify(sentMessage));
        } catch (sendError) {
          console.error('Error al enviar mensaje:', sendError);
          throw sendError;
        }
      } else {
        console.log('Mensaje ignorado: no es de un usuario o no contiene texto');
      }
    } catch (error) {
      console.error('Error procesando actualización de Telegram:', error);
      try {
        const errorMessage = await this.bot.sendMessage(update.message.chat.id, "Lo siento, ocurrió un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.");
        console.log('Mensaje de error enviado:', JSON.stringify(errorMessage));
      } catch (sendError) {
        console.error('Error al enviar mensaje de error:', sendError);
      }
    }
    console.log('TelegramService.handleUpdate: Finalizando procesamiento de actualización');
  }
}

module.exports = new TelegramService();