import nodemailer from "nodemailer";
import AppError from "../utils/AppError.js";

const transporterCache = new Map();

/**
 * Creates and caches an email transporter for a specific tenant.
 * 
 * @param {Object} tenantEmailConfig - The tenant's email configuration
 * @returns {Object} { sendEmail: function }
 */
export const createEmailService = (tenantEmailConfig) => {
  if (!tenantEmailConfig || !tenantEmailConfig.user || !tenantEmailConfig.pass) {
    throw new AppError('Email service not properly configured for this store', 503);
  }

  const key = tenantEmailConfig.user;

  if (!transporterCache.has(key)) {
    transporterCache.set(key, nodemailer.createTransport({
      service: tenantEmailConfig.service || 'gmail',
      auth: { 
        user: tenantEmailConfig.user, 
        pass: tenantEmailConfig.pass 
      },
    }));
  }
  
  return {
    sendEmail: async (to, subject, text, html) => {
      try {
        const transporter = transporterCache.get(key);
        const senderName = tenantEmailConfig.senderName || "Store Team";
        
        await transporter.sendMail({
          from: `${senderName} <${tenantEmailConfig.user}>`,
          to,
          subject,
          text,
          html,
        });
      } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        throw new AppError("Failed to send email", 500);
      }
    }
  };
};
