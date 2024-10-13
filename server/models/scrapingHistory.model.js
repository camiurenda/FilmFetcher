const mongoose = require('mongoose');

const ScrapingHistorySchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sites',
    required: true
  },
  fechaScraping: {
    type: Date,
    default: Date.now
  },
  estado: {
    type: String,
    enum: ['exitoso', 'fallido'],
    default: 'exitoso'
  },
  mensajeError: {
    type: String
  },
  cantidadProyecciones: {
    type: Number,
    default: 0
  },
  respuestaOpenAI: {
    type: String
  },
  causaFallo: {
    type: String
  }
});

module.exports = mongoose.model('ScrapingHistory', ScrapingHistorySchema);