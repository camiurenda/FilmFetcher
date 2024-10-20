const axios = require('axios');

class TelegramService {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    if (!this.token) {
      console.error('TELEGRAM_BOT_TOKEN no está configurado');
    } else {
      console.log('TelegramService inicializado con token válido');
    }
    this.apiUrl = `https://api.telegram.org/bot${this.token}/api/telegram-webhook`;
  }

  async runDiagnostics() {
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
    }

    const diagnostics = {
      tokenCheck: false,
      getMe: null,
      sendMessage: null
    };

    try {
      // Verificar getMe
      const getMeResponse = await axios.get(`${this.apiUrl}/getMe`);
      diagnostics.tokenCheck = true;
      diagnostics.getMe = getMeResponse.data;

      // Intentar enviar un mensaje (asegúrate de tener un chat_id válido)
      const chatId = process.env.TELEGRAM_TEST_CHAT_ID; // Debes configurar esto en tu .env
      if (chatId) {
        const sendMessageResponse = await axios.post(`${this.apiUrl}/sendMessage`, {
          chat_id: chatId,
          text: 'Este es un mensaje de prueba de diagnóstico.'
        });
        diagnostics.sendMessage = sendMessageResponse.data;
      } else {
        diagnostics.sendMessage = 'TELEGRAM_TEST_CHAT_ID no está configurado';
      }
    } catch (error) {
      throw new Error(`Error en diagnóstico: ${error.message}`);
    }

    return diagnostics;
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