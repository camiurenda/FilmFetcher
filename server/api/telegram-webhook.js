const TelegramService = require('../services/telegram.service');

module.exports = async (req, res) => {
  console.log('Webhook de Telegram recibido:', req.method, JSON.stringify(req.body));
  
  if (req.method !== 'POST') {
    console.log('Método no permitido:', req.method);
    return res.status(405).json({ error: 'Método no permitido' });
  }

  console.log('Enviando respuesta 200 OK');
  res.status(200).json({ message: 'OK' });

  console.log('Iniciando procesamiento asíncrono de la actualización');
  try {
    console.log('Llamando a TelegramService.handleUpdate');
    await TelegramService.handleUpdate(req.body);
    console.log('TelegramService.handleUpdate completado con éxito');
  } catch (error) {
    console.error('Error al procesar la actualización de Telegram:', error);
    console.error('Stack trace:', error.stack);
  }
  console.log('Procesamiento asíncrono finalizado');
};