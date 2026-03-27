import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test cloudinary connection
const testCloudinaryConnection = async () => {
  try {
    const result = await cloudinary.api.ping();
    logger.info('Cloudinary connection successful');
    return true;
  } catch (error) {
    logger.error('Cloudinary connection failed:', error);
    return false;
  }
};

export { cloudinary, testCloudinaryConnection };
