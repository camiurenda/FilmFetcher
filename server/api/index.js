const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { auth, requiresAuth } = require('express-openid-connect');
const siteRoutes = require('../routes/site.routes');
const projectionRoutes = require('../routes/projection.routes');
const ScrapingService = require('../services/scraping.service'); 
const statsRoutes = require('../routes/stats.routes');
const scrapingScheduleRoutes = require('../routes/scrapingSchedule.routes');
const ScheduleManager = require('../services/schedule.service');

require('dotenv').config();

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  issuerBaseURL: process.env.ISSUER_BASE_URL
};

const app = express();

morgan.token('custom-log', (req, res) => {
  if (res.locals.customLog) {
    const log = res.locals.customLog;
    res.locals.customLog = '';
    return log;
  }
  return '';
});

app.use(morgan(':method :url :status :response-time ms :custom-log'));
app.use(express.json());
app.use(auth(config));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://film-fetcher-eta.vercel.app',
  'https://film-fetcher-exc9.vercel.app',
  'https://filmfetcher.onrender.com/',
  'https://testpuppeteer-1d96.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use('/api', siteRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/projections', projectionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/scraping-schedule', scrapingScheduleRoutes)

const originalConsoleLog = console.log;
console.log = (...args) => {
  if (args.length) {
    const log = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ');
    if (global.currentResponse) {
      global.currentResponse.locals.customLog = (global.currentResponse.locals.customLog || '') + log + '\n';
    }
  }
  originalConsoleLog.apply(console, args);
};

app.get('/', (req, res) => {
  res.send('Servidor funcionando!!!');
});

app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
});

app.get('/protected', requiresAuth(), (req, res) => {
  res.send('¡Esta ruta está protegida!');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'El backend de Film Fetcher está funcionando correctamente.' });
});

// Inicialización de servicios
const initializeServices = async () => {
  try {
      console.log('Iniciando servicios...');
      
      // 1. Conectar a MongoDB
      await mongoose.connect(process.env.MONGO_DB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true
      });
      console.log('Conectado exitosamente a MongoDB');
      
      // 2. Inicializar servicios individualmente
      await initializeScrapingServices();
      
      console.log('Todos los servicios iniciados correctamente');
  } catch (err) {
      console.error('Error durante la inicialización:', err);
      throw err;
  }
};

/**
* Inicializa los servicios de scraping asegurando el orden correcto
*/
const initializeScrapingServices = async () => {
  try {
      console.log('Inicializando servicios de scraping...');

      // 1. Verificar que los servicios existen
      if (!ScrapingService || !ScheduleManager) {
          throw new Error('Servicios no encontrados');
      }

      // 2. Limpiar estado previo si existe
      ScheduleManager.clearAll && await ScheduleManager.clearAll();
      ScrapingService.clearAll && await ScrapingService.clearAll();

      // 3. Inyectar dependencias
      console.log('Inyectando dependencias entre servicios...');
      ScrapingService.setScheduleManager(ScheduleManager);
      ScheduleManager.setScrapingService(ScrapingService);

      // 4. Verificar inyección exitosa
      if (!ScheduleManager.scrapingService) {
          throw new Error('Fallo en la inyección del ScrapingService');
      }

      // 5. Inicializar schedules
      console.log('Inicializando schedules...');
      await ScheduleManager.inicializarSchedules();
      
      console.log('Servicios de scraping inicializados correctamente');
  } catch (error) {
      console.error('Error en la inicialización de servicios de scraping:', error);
      throw error;
  }
};

initializeServices();

module.exports = app;