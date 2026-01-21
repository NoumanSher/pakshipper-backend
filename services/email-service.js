import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file
let transporter = nodemailer.createTransport({
  service: "gmail",
  port: 465, // Use 587 if you are not using SSL
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Admin email
    pass: process.env.EMAIL_PASS, // Admin password
  },
});
/**
 * Send an email using the Nodemailer transporter
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject 
 * @param {string} text - Plain text version of the email content
 * @param {string} html - HTML version of the email content
 * @returns {Promise<void>}
 */
export const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `${process.env.EMAIL_SERVICE_NAME} <${process.env.EMAIL_USER}>`, // Sender address
      to,
      subject,
      text,
      html,
    });

    console.log("Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};
