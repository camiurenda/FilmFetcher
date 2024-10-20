const TelegramBot = require('node-telegram-bot-api');
const ChatbotService = require('./chatbot.service');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    const webhookUrl = `${process.env.BACKEND_URL}/api/telegram-webhook`;
    console.log('Configurando webhook de Telegram en:', webhookUrl);
    this.bot.setWebHook(webhookUrl);
  }

  async handleUpdate(update) {
    try {
      const message = update.message;
      if (message) {
        const chatId = message.chat.id;

        if (message.text === '/start') {
          await this.bot.sendMessage(chatId, '¡Bienvenido a FilmFetcher Bot! Estoy aquí para ayudarte con información sobre películas y cines. ¿Qué te gustaría saber?');
        } else if (!message.text.startsWith('/')) {
          try {
            const respuesta = await ChatbotService.procesarMensaje(message.text);
            await this.bot.sendMessage(chatId, respuesta);
          } catch (error) {
            console.error('Error al procesar mensaje:', error);
            await this.bot.sendMessage(chatId, 'Lo siento, ha ocurrido un error al procesar tu mensaje. Por favor, intenta de nuevo más tarde.');
          }
        }
      }
    } catch (error) {
      console.error('Error procesando actualización de Telegram:', error);
    }
  }
  async checkStatus() {
    try {
      const me = await this.bot.getMe();
      return {
        ok: true,
        botName: me.username,
        botId: me.id
      };
    } catch (error) {
      console.error('Error al verificar el estado del bot:', error);
      return {
        ok: false,
        error: error.message
      };
    }
  }
}

module.exports = new TelegramService();