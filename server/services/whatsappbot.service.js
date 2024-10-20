const puppeteer = require('puppeteer-core');
const chrome = require('chrome-aws-lambda');
const fs = require('fs').promises;
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const getPuppeteerOptions = async () => {
  let options;
  if (process.env.NODE_ENV === 'production') {
    options = {
      args: chrome.args,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || await chrome.executablePath,
      headless: chrome.headless,
    };
  } else {
    options = {
      args: [],
      executablePath: puppeteer.executablePath(),
      headless: true,
    };
  }
  return {
    ...options,
    headless: "new",
    args: [
      ...options.args,
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
  };
};

const initializeWhatsAppClient = async () => {
  const options = await getPuppeteerOptions();
  const browser = await puppeteer.launch(options);
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
    try {
      await fs.rm(path.join(process.cwd(), '.wwebjs_auth'), { recursive: true, force: true });
    } catch (error) {
      console.error('Error al intentar eliminar la carpeta de autenticación:', error);
    }

    const client = await initializeWhatsAppClient();
    await client.initialize();
  } catch (error) {
    console.error('Error al inicializar el cliente de WhatsApp:', error);
    // Intenta reiniciar el cliente si falla la inicialización
    setTimeout(async () => {
      console.log('Intentando reiniciar el cliente de WhatsApp...');
      try {
        const client = await initializeWhatsAppClient();
        await client.initialize();
      } catch (retryError) {
        console.error('Error al reiniciar el cliente de WhatsApp:', retryError);
      }
    }, 5000);
  }
};

module.exports = { initialize };