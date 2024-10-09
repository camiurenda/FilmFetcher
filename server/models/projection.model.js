const mongoose = require('mongoose');

const ProjectionSchema = new mongoose.Schema({
  nombrePelicula: {
    type: String,
    required: true,
  },
  fechaHora: {
    type: Date,
    required: true,
  },
  director: {
    type: String,
    required: true,
  },
  genero: {
    type: String,
    required: true,
  },
  duracion: {
    type: Number,
    required: true,
  },
  sala: {
    type: String,
    required: true,
  },
  precio: {
    type: Number,
    required: true,
  },
  habilitado: {
    type: Boolean,
    default: true,
  },
  sitio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sites',
    required: true,
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  cargaManual: {
    type: Boolean,
    default: false,
  }
});

module.exports = mongoose.model('Projection', ProjectionSchema);