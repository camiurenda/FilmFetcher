const express = require('express');
const router = express.Router();
const ScrapingHistory = require('../models/scrapingHistory.model');

// Get all scraping history
router.get('/', async (req, res) => {
  try {
    const history = await ScrapingHistory.find()
      .populate('siteId')
      .sort({ fechaScraping: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
