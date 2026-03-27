import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import logger from '../utils/logger.js';

let mongoServer = null;

const connectDB = async () => {
  try {
    let connectOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000 // fail fast if no local db
    };

    try {
      // Try local primary MongoDB first
      const conn = await mongoose.connect(process.env.MONGODB_URI, connectOptions);
      logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
      if (err.name === 'MongooseServerSelectionError') {
         logger.warn('Could not connect to MongoDB URI. Starting in-memory database fallback to allow backend to run...');
         mongoServer = await MongoMemoryServer.create();
         const tempUri = mongoServer.getUri();
         await mongoose.connect(tempUri, { useNewUrlParser: true, useUnifiedTopology: true });
         logger.info(`In-Memory MongoDB Connected for testing purposes!`);
      } else {
         throw err;
      }
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      if (mongoServer) {
         await mongoServer.stop();
      }
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Database connection failed totally:', error);
    process.exit(1);
  }
};

export default connectDB;
