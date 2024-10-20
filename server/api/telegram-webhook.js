// const TelegramService = require('../services/telegram.service');

// module.exports = async (req, res) => {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Método no permitido' });
//   }

//   try {
//     await TelegramService.handleUpdate(req.body);
//     res.status(200).json({ message: 'OK' });
//   } catch (error) {
//     console.error('Error al procesar la actualización de Telegram:', error);
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }
// };