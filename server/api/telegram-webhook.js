const TelegramService = require('../services/telegram.service');

module.exports = async (req, res) => {
  console.log('Webhook de Telegram recibido:', req.method, JSON.stringify(req.body));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  res.status(200).json({ message: 'OK' });
  try {
    await TelegramService.handleUpdate(req.body);
  } catch (error) {
    console.error('Error al procesar la actualización de Telegram:', error);
  }
};