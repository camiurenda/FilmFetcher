const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cambia la ubicación del caché para Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};