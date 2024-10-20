const TelegramBot = require('node-telegram-bot-api');
const ChatbotService = require('./chatbot.service');
const axios = require('axios');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
    this.webhookConfigured = false;
  }

  async setupWebhook() {
    if (this.webhookConfigured) return;

    const webhookUrl = `${process.env.BACKEND_URL}/api/telegram-webhook`;
    console.log('Intentando configurar webhook de Telegram en:', webhookUrl);
    
    try {
      const response = await this.bot.setWebHook(webhookUrl);
      if (response) {
        console.log('Webhook configurado exitosamente');
        this.webhookConfigured = true;
      } else {
        throw new Error('La respuesta de Telegram no fue exitosa');
      }
    } catch (error) {
      console.error('Error al configurar webhook:', error.message);
    }
  }

  async handleUpdate(update) {
    try {
      console.log('Procesando actualización de Telegram:', JSON.stringify(update));
      const message = update.message;
      if (message && message.text) {
        const chatId = message.chat.id;
        let respuesta;

        if (message.text === '/start') {
          respuesta = '¡Bienvenido a FilmFetcher Bot! Estoy aquí para ayudarte con información sobre películas y cines. ¿Qué te gustaría saber?';
        } else {
          respuesta = await ChatbotService.procesarMensaje(message.text);
        }

        await this.bot.sendMessage(chatId, respuesta);
        console.log('Respuesta enviada:', respuesta);
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