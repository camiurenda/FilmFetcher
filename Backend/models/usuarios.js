const mongoose = require('mongoose');
const { Schema } = mongoose;

const esquemaUsuario = new Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  creacion: { type: Date, default: Date.now },
  ultimologin: { type: Date, default: null },
  rol: { type: String, enum: ['moderador', 'admin'], default: 'user' },
});

module.exports = mongoose.model('User', esquemaUsuario);
