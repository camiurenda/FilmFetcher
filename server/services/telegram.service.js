const TelegramBot = require('node-telegram-bot-api');
const ChatbotService = require('./chatbot.service');
const axios = require('axios');


class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    this.setupWebhook();
  }

  async setupWebhook(retryCount = 0) {
    const webhookUrl = `${process.env.BACKEND_URL}/api/telegram-webhook`;
    console.log('Intentando configurar webhook de Telegram en:', webhookUrl);
    
    try {
      const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        url: webhookUrl
      });
      
      if (response.data.ok) {
        console.log('Webhook configurado exitosamente');
      } else {
        throw new Error('La respuesta de Telegram no fue exitosa');
      }
    } catch (error) {
      console.error('Error al configurar webhook:', error.response ? error.response.data : error.message);
      
      if (retryCount < 5) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Reintentando en ${delay} ms...`);
        setTimeout(() => this.setupWebhook(retryCount + 1), delay);
      } else {
        console.error('Máximo número de intentos alcanzado. No se pudo configurar el webhook.');
      }
    }
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
  async getBotInfo() {
    try {
      const me = await this.bot.getMe();
      const webhookInfo = await this.bot.getWebHookInfo();
      return { me, webhookInfo };
    } catch (error) {
      console.error('Error al obtener información del bot:', error);
      throw error;
    }
  }  
}

module.exports = new TelegramService();