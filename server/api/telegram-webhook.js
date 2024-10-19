const TelegramService = require('../services/telegram.service');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    await TelegramService.handleUpdate(req.body);
    res.status(200).send('OK');
  } else {
    res.status(405).send('Method Not Allowed');
  }
};