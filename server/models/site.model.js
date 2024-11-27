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
  tipoArchivo: {
    type: String,
    enum: ['imagen', 'pdf'],
    required: function() { return this.tipoCarga === 'manual'; },
  },
  frecuenciaActualizacion: {
    type: String,
    enum: ['diaria', 'semanal', 'mensual', 'test'],
    required: function() { return this.tipoCarga === 'scraping'; },
  },
  precioDefault: {
    type: Number,
    min: 0,
    default: null,
  },
  esGratis: {
    type: Boolean,
    default: false,
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
  },
  configuracionScraping: {
    tipoFrecuencia: {
      type: String,
      enum: ['diaria', 'semanal', 'mensual-dia', 'mensual-posicion', 'test'],
    },
    hora: String,
    diasSemana: [Number],
    diaMes: Number,
    semanaMes: String,
    diaSemana: Number,
    ultimoScrapingExitoso: Date,
    errores: [{
      fecha: Date,
      mensaje: String
    }]
  }
});

SiteSchema.pre('save', function(next) {
  console.log('Pre-save hook ejecutándose para sitio:', this._id);
  console.log('Datos del sitio:', this.toObject());
  
  if (this.tipoCarga === 'scraping' && !this.frecuenciaActualizacion) {
    next(new Error('La frecuencia de actualización es requerida para sitios de scraping'));
    return;
  }
  
  next();
});

SiteSchema.pre('findOneAndUpdate', function(next) {
  console.log('Pre-update hook ejecutándose');
  console.log('Update data:', this.getUpdate());
  
  const update = this.getUpdate();
  if (update.tipoCarga === 'scraping' && !update.frecuenciaActualizacion) {
    next(new Error('La frecuencia de actualización es requerida para sitios de scraping'));
    return;
  }
  
  next();
});

module.exports = mongoose.model('Sites', SiteSchema);