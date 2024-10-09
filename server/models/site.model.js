const mongoose = require('mongoose');

const SiteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  direccion: {
    type: String,
  },
  tipo: {
    type: String,
    enum: ['cine', 'teatro', 'museo'],
  },
  tipoCarga: {
    type: String,
    enum: ['scraping', 'manual'],
    required: true,
  },
  frecuenciaActualizacion: {
    type: String,
    enum: ['diaria', 'semanal', 'mensual', 'test'],
    required: function() { return this.tipoCarga === 'scraping'; },
  },
  usuarioCreador: {
    type: String,
    required: true,
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  habilitado: {
    type: Boolean,
    default: true,
  },
  activoParaScraping: {
    type: Boolean,
    default: function() { return this.tipoCarga === 'scraping'; },
  }
});

module.exports = mongoose.model('Sites', SiteSchema);