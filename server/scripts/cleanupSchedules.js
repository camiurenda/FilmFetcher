require('dotenv').config();
const mongoose = require('mongoose');
const ScrapingSchedule = require('../models/scrapingSchedule.model');

async function cleanupSchedules() {
  try {
    console.log('Attempting to connect to MongoDB...');
    
    // Log the connection string being used (without sensitive info)
    const dbUrl = 'mongodb+srv://urendacamila:urendacamilaMongo@clustermongodb.95vstra.mongodb.net/FilmFetcher';
    console.log('Using database URL:', dbUrl);

    await mongoose.connect(dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Successfully connected to MongoDB');

    // Find all schedules for the site
    const siteId = '6709fcb9b31624db8afc9a46';
    console.log('Looking for schedules for site:', siteId);

    const schedules = await ScrapingSchedule.find({
      sitioId: siteId
    }).sort({ _id: -1 });

    console.log(`Found ${schedules.length} schedules for the site`);

    if (schedules.length <= 1) {
      console.log('No duplicate schedules found');
      return;
    }

    // Keep the most recent schedule active and deactivate the rest
    const [mostRecent, ...oldSchedules] = schedules;
    
    console.log('Most recent schedule:', {
      id: mostRecent._id,
      tipoFrecuencia: mostRecent.tipoFrecuencia,
      proximaEjecucion: mostRecent.proximaEjecucion
    });
    
    if (oldSchedules.length > 0) {
      console.log(`Found ${oldSchedules.length} old schedules to deactivate`);
      
      const result = await ScrapingSchedule.updateMany(
        { 
          _id: { $in: oldSchedules.map(s => s._id) }
        },
        { 
          $set: { activo: false }
        }
      );

      console.log(`Deactivated ${result.modifiedCount} old schedules`);
    }

    // Ensure the most recent schedule is active
    const updateResult = await ScrapingSchedule.findByIdAndUpdate(
      mostRecent._id,
      { $set: { activo: true } },
      { new: true }
    );

    console.log('Most recent schedule is now active:', {
      id: updateResult._id,
      tipoFrecuencia: updateResult.tipoFrecuencia,
      proximaEjecucion: updateResult.proximaEjecucion,
      activo: updateResult.activo
    });

    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
    }
    process.exit(0);
  }
}

// Add error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});

console.log('Starting cleanup script...');
cleanupSchedules();
