const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { auth, requiresAuth } = require('express-openid-connect');
const siteRoutes = require('../routes/site.routes');
const projectionRoutes = require('../routes/projection.routes');
const ScrapingService = require('../services/scraping.service'); 
const scrapingScheduleRoutes = require('../routes/scrapingSchedule.routes');
const scrapingHistoryRoutes = require('../routes/scrapingHistory.routes');
const statsRoutes = require('../routes/stats.routes');


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

app.use('/api/sites', siteRoutes);
app.use('/api/projections', projectionRoutes);
app.use('/api/scraping-schedule', scrapingScheduleRoutes);
app.use('/api/scraping-history', scrapingHistoryRoutes);
app.use('/api/stats', statsRoutes);

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
    await mongoose.connect(process.env.MONGO_DB_URI, {});
    console.log('Conectado exitosamente a MongoDB');
    await ScrapingService.initializeJobs();
    console.log('Trabajos de scraping inicializados');
  } catch (err) {
    console.error('Error durante la inicialización:', err);
  }
};

initializeServices();

module.exports = app;