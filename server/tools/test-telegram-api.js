const axios = require('axios');
require('dotenv').config({ path: '../.env' }); // Asegúrate de que dotenv esté instalado

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = 1134524907; // Este es el ID de chat que vimos en los logs

async function testTelegramAPI() {
  const apiUrl = `https://api.telegram.org/bot${token}`;

  try {
    console.log('Probando getMe...');
    const getMeResponse = await axios.get(`${apiUrl}/getMe`);
    console.log('Respuesta de getMe:', JSON.stringify(getMeResponse.data, null, 2));

    console.log('\nProbando sendMessage...');
    const sendMessageResponse = await axios.post(`${apiUrl}/sendMessage`, {
      chat_id: chatId,
      text: 'Este es un mensaje de prueba desde el script de verificación.'
    });
    console.log('Respuesta de sendMessage:', JSON.stringify(sendMessageResponse.data, null, 2));

    console.log('\nPruebas completadas con éxito.');
  } catch (error) {
    console.error('Error durante las pruebas:', error.message);
    if (error.response) {
      console.error('Respuesta de error de la API:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTelegramAPI();