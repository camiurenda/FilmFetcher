const TelegramBot = require('node-telegram-bot-api');
const ChatbotServiceMejorado = require('./chatbot-service-mejorado');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.initializeBot();
  }

  initializeBot() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, '¡Bienvenido a FilmFetcher Bot! Estoy aquí para ayudarte con información sobre películas y cines. ¿Qué te gustaría saber?');
    });

    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      if (msg.text.startsWith('/')) return; // Ignorar otros comandos

      try {
        const respuesta = await ChatbotServiceMejorado.procesarMensaje(msg.text);
        this.bot.sendMessage(chatId, respuesta);
      } catch (error) {
        console.error('Error al procesar mensaje:', error);
        this.bot.sendMessage(chatId, 'Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.');
      }
    });
  }
}

module.exports = TelegramService;