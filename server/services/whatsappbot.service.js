const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const OpenAI = require('openai');
const Projection = require('../models/projection.model');
const WebSocket = require('ws');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let wss;

const initializeWebSocket = (server) => {
  wss = new WebSocket.Server({ server });
  console.log('WebSocket server initialized');
};

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox'],
  }
});

client.on('qr', async (qr) => {
  try {
    const qrImage = await qrcode.toDataURL(qr);
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'qr', data: qrImage }));
        }
      });
    }
  } catch (error) {
    console.error('Error al generar o enviar el código QR:', error);
  }
});

client.on('ready', () => {
  console.log('WhatsApp bot is ready!');
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'status', data: 'ready' }));
      }
    });
  }
});

client.on('message', async (msg) => {
  const userMessage = msg.body.toLowerCase();

  if (userMessage.includes('/start')) {
    msg.reply('¡Hola! Soy tu bot de cartelera de cine. ¿En qué puedo ayudarte?');
  } else if (userMessage.includes('/cartelera')) {
    try {
      const projections = await Projection.find({ habilitado: true });
      const message = projections.map(p => `${p.nombrePelicula} - ${new Date(p.fechaHora).toLocaleString()}`).join('\n');
      msg.reply(`Cartelera:\n${message}`);
    } catch (error) {
      console.error('Error fetching projections:', error);
      msg.reply('Hubo un error al obtener la cartelera.');
    }
  } else {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un asistente que ayuda a los usuarios a encontrar información sobre la cartelera de cine." },
          { role: "user", content: userMessage }
        ]
      });

      const aiResponse = response.choices[0].message.content;
      msg.reply(aiResponse);
    } catch (error) {
      console.error('Error processing message:', error);
      msg.reply('Hubo un error al procesar tu mensaje.');
    }
  }
});

client.initialize();

module.exports = client;