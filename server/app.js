require('./puppeteer.config.cjs');

const app = require('./api/index');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});