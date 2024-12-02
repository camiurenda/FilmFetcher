const app = require('./api/index');
const moment = require('moment-timezone');

moment.tz.setDefault('America/Argentina/Buenos_Aires');

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
  console.log(`Timezone configurado: ${moment.tz.guess()}`);
  console.log(`Hora actual del servidor: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
});