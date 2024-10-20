const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs').promises;
const OpenAI = require('openai');
const Projection = require('../models/projection.model');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let wss;

const getPuppeteerOptions = () => ({
  headless: "new",
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu'
  ],
  defaultViewport: null,
  ignoreHTTPSErrors: true,
  timeout: 60000
});

const initializeWhatsAppClient = async () => {
  const browser = await puppeteer.launch(getPuppeteerOptions());
  const authStrategy = new LocalAuth({
    clientId: "film-fetcher-whatsapp-bot",
    dataPath: path.join(process.cwd(), '.wwebjs_auth')
  });

  const client = new Client({
    authStrategy: authStrategy,
    puppeteer: {
      browser: browser
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

  return client;
};

const initialize = async (server, websocketServer) => {
  wss = websocketServer;
  try {
    // Intenta eliminar la carpeta de autenticación si existe
    await fs.rmdir(path.join(process.cwd(), '.wwebjs_auth'), { recursive: true });
  } catch (error) {
    console.error('Error al intentar eliminar la carpeta de autenticación:', error);
  }

  try {
    const client = await initializeWhatsAppClient();
    await client.initialize();
  } catch (error) {
    console.error('Error al inicializar el cliente de WhatsApp:', error);
    setTimeout(async () => {
      console.log('Intentando reiniciar el cliente de WhatsApp...');
      const client = await initializeWhatsAppClient();
      await client.initialize();
    }, 5000);
  }
};

module.exports = { initialize };