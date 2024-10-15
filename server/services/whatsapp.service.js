const axios = require('axios');
const config = require('../config/whatsapp.config');

class WhatsAppService {
  async sendMessage(to, message) {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message }
        },
        {
          headers: {
            "Authorization": `Bearer ${config.accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      console.log('Mensaje enviado:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error al enviar mensaje:', error.response ? error.response.data : error.message);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();