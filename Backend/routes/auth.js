const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Login
router.post('/login', async (req, res) => {
  // acá iria la lógica de login
});

// Registro
router.post('/register', async (req, res) => {
  // acá iria la lógica de registro
});

module.exports = router;
