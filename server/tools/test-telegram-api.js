const axios = require('axios');

   // IMPORTANTE: No subas este archivo con el token real a un repositorio público
   const token = '7934828331:AAGc59cExe1FOVxOAyZiNFkJpNRZE5YrtkU'; // Reemplaza con tu token real
   const chatId = 1134524907;
   console.log('Token cargado:', token ? 'Sí' : 'No');
   if (token) {
     console.log('Primeros 5 caracteres del token:', token.substring(0, 5));
   }
   
   async function testTelegramAPI() {
     if (!token) {
       console.error('TELEGRAM_BOT_TOKEN no está configurado');
       return;
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
     } catch (error) {
       console.error('Error durante las pruebas:', error.message);
       if (error.response) {
         console.error('Respuesta de error de la API:', JSON.stringify(error.response.data, null, 2));
       }
     }
   }
   
   testTelegramAPI();