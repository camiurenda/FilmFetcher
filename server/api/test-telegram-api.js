const axios = require('axios');

async function testTelegramAPI() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = '1134524907';

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN no está configurado');
  }

  const apiUrl = `https://api.telegram.org/bot${token}`;
  console.log('URL de la API:', apiUrl);

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
    return {
      getMe: getMeResponse.data,
      sendMessage: sendMessageResponse.data
    };
  } catch (error) {
    console.error('Error durante las pruebas:', error.message);
    if (error.response) {
      console.error('Respuesta de error de la API:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    const result = await testTelegramAPI();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};