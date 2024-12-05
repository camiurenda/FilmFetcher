const mongoose = require('mongoose');
const uri = 'mongodb+srv://urendacamila:urendacamilaMongo@clustermongodb.95vstra.mongodb.net/FilmFetcher';

async function migrate() {
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const Site = require('./models/site.model.js');
        const ScrapingSchedule = require('./models/scrapingSchedule.model.js');
        
        // Update Sites
        const siteResult = await Site.updateMany(
            { 'configuracionScraping.tipoFrecuencia': 'mensual-dia' },
            { '$set': { 'configuracionScraping.tipoFrecuencia': 'mensual' } }
        );
        
        // Update ScrapingSchedules
        const scheduleResult = await ScrapingSchedule.updateMany(
            { tipoFrecuencia: 'mensual-dia' },
            { '$set': { tipoFrecuencia: 'mensual' } }
        );
        
        console.log('Migration Results:', {
            sites: siteResult,
            schedules: scheduleResult
        });
    } catch (error) {
        console.error('Migration Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

migrate();
