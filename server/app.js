const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { auth, requiresAuth } = require('express-openid-connect');
const siteRoutes = require('./routes/site.routes');
const projectionRoutes = require('./routes/projection.routes');
const ScrapingService = require('./services/scraping.service'); 
const statsRoutes = require('./routes/stats.routes');

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'a long, randomly-generated string stored in env',
  baseURL: 'http://localhost:3000',
  clientID: 'ylCwDbHoy8TbjzWlDQ4DZ1LXJvWSBDhE',
  issuerBaseURL: 'https://dev-8ctrmmam10bofjis.us.auth0.com'
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

require('dotenv').config();
app.use(morgan(':method :url :status :response-time ms :custom-log'));
app.use(express.json());
app.use(auth(config));

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  process.env.FRONTEND_URL,
  'https://film-fetcher-eta.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Permitir solicitudes sin origen (como aplicaciones móviles o curl)
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
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});

mongoose.connect(process.env.MONGO_DB_URI, {
})
  .then(() => {
    console.log('Conectado a MongoDB');
    return ScrapingService.initializeJobs(); // Inicializa los jobs después de conectar a MongoDB
  })
  .then(() => {
    console.log('Trabajos de scraping inicializados');
  })
  .catch(err => console.error('Error:', err));

app.get('/profile', requiresAuth(), (req, res) => {
  res.send(JSON.stringify(req.oidc.user));
});

app.get('/protected', requiresAuth(), (req, res) => {
  res.send('¡Esta ruta está protegida!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});