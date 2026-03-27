import Stripe from 'stripe';
import logger from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Test Stripe connection
const testStripeConnection = async () => {
  try {
    const account = await stripe.accounts.retrieve();
    logger.info('Stripe connection successful');
    return true;
  } catch (error) {
    logger.error('Stripe connection failed:', error);
    return false;
  }
};

export { stripe, testStripeConnection };
