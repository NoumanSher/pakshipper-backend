import AppError from "../utils/AppError.js";

/**
 * Creates Cloudinary configuration for a specific tenant.
 * 
 * @param {Object} tenantConfig - The tenant's configuration object
 * @param {String} type - 'merchant' or 'customer'
 * @returns {Object|null} Cloudinary config object or null if not configured
 */
export const getCloudinaryConfig = (tenantConfig, type = 'merchant') => {
  if (!tenantConfig || !tenantConfig.cloudinary) {
    return null;
  }

  const account = type === 'merchant'
    ? tenantConfig.cloudinary.merchantAccount
    : tenantConfig.cloudinary.customerAccount;
  
  if (!account || !account.cloudName || !account.apiKey || !account.apiSecret) {
    return null;
  }
  
  return {
    cloud_name: account.cloudName,
    api_key: account.apiKey,
    api_secret: account.apiSecret,
  };
};
