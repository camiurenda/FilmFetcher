const axios = require('axios');

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      console.error('TELEGRAM_BOT_TOKEN no está configurado');
    } else {
      console.log('TelegramService inicializado con token válido');
    }
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async setupWebhook() {
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    const webhookUrl = `${process.env.VERCEL_URL}/api/telegram-webhook`;
    console.log(`Configurando webhook en: ${webhookUrl}`);

    try {
      const response = await axios.post(`${this.apiUrl}/setWebhook`, {
        url: webhookUrl
      });
      console.log('Webhook configurado:', response.data);
    } catch (error) {
      console.error('Error al configurar el webhook:', error.message);
      if (error.response) {
        console.error('Detalles del error de la API:', error.response.data);
      }
    }
  }

  async handleUpdate(update) {
    console.log('TelegramService.handleUpdate: Iniciando procesamiento de actualización');
    try {
      console.log('Procesando actualización de Telegram:', JSON.stringify(update));
      const message = update.message;
      if (message && message.text) {
        const chatId = message.chat.id;
        console.log(`Mensaje recibido de chatId: ${chatId}, texto: "${message.text}"`);

        let respuesta = message.text === '/start'
          ? '¡Bienvenido a FilmFetcher Bot! Estoy aquí para ayudarte con información sobre películas y cines. ¿Qué te gustaría saber?'
          : `Recibí tu mensaje: "${message.text}". Pronto implementaremos más funcionalidades.`;

        console.log(`Respuesta generada: "${respuesta}"`);
        console.log(`Intentando enviar respuesta a ${chatId}`);
        
        try {
          console.log('Iniciando solicitud a la API de Telegram');
          console.log(`URL de la API: ${this.apiUrl}/sendMessage`);
          console.log('Datos de la solicitud:', JSON.stringify({
            chat_id: chatId,
            text: respuesta
          }));

          const response = await axios.post(`${this.apiUrl}/sendMessage`, {
            chat_id: chatId,
            text: respuesta
          });

          console.log('Respuesta de la API de Telegram:', JSON.stringify(response.data));
          
          if (response.data && response.data.ok) {
            console.log('Mensaje enviado exitosamente');
          } else {
            console.error('La API de Telegram respondió con un error:', response.data);
          }
        } catch (sendError) {
          console.error('Error al enviar mensaje:', sendError.message);
          if (sendError.response) {
            console.error('Detalles del error de la API:', JSON.stringify(sendError.response.data));
          } else if (sendError.request) {
            console.error('No se recibió respuesta de la API');
          } else {
            console.error('Error al configurar la solicitud:', sendError.message);
          }
          console.error('Configuración de la solicitud:', sendError.config);
        }
      }
    } catch (error) {
      console.error('Error procesando actualización de Telegram:', error.message);
      console.error('Stack trace:', error.stack);
    }
    console.log('TelegramService.handleUpdate: Finalizando procesamiento de actualización');
  }
}

module.exports = new TelegramService();