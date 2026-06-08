import Stripe from "stripe";
import AppError from "../utils/AppError.js";

const stripeInstances = new Map();

/**
 * Retrieves or creates a cached Stripe instance for a tenant.
 * 
 * @param {Object} tenantConfig - Decrypted tenant configuration
 * @returns {Stripe} Stripe instance
 */
export const getStripeInstance = (tenantConfig) => {
  const secretKey = tenantConfig?.stripe?.secretKey;
  if (!secretKey) {
    throw new AppError('Stripe not configured for this store', 503);
  }
  
  if (!stripeInstances.has(secretKey)) {
    stripeInstances.set(secretKey, new Stripe(secretKey));
  }
  return stripeInstances.get(secretKey);
};
