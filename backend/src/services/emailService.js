import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';
import crypto from 'crypto';

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Generate OTP
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};

// Generate random token
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Send email
export const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

// Send welcome email
export const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Nexus - Investor & Entrepreneur Platform';
  const text = `Welcome ${user.firstName} ${user.lastName}!\n\nThank you for joining Nexus. Your account has been created successfully.\n\nBest regards,\nThe Nexus Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Nexus!</h2>
      <p>Hi ${user.firstName} ${user.lastName},</p>
      <p>Thank you for joining Nexus - the premier platform for investors and entrepreneurs to connect and collaborate.</p>
      <p>Your account has been created successfully. You can now start exploring opportunities and building meaningful connections.</p>
      <p>Best regards,<br>The Nexus Team</p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
};

// Send meeting invitation
export const sendMeetingInvitation = async (meeting, recipient) => {
  const subject = `Meeting Invitation: ${meeting.title}`;
  const text = `You have been invited to a meeting: ${meeting.title}\n\nTime: ${meeting.startTime}\nDuration: ${meeting.duration} minutes\n\nClick here to join: ${meeting.meetingLink}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Meeting Invitation</h2>
      <p>You have been invited to a meeting on Nexus.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>${meeting.title}</h3>
        <p><strong>Time:</strong> ${meeting.startTime}</p>
        <p><strong>Duration:</strong> ${meeting.duration} minutes</p>
        <p><strong>Organizer:</strong> ${meeting.organizer.firstName} ${meeting.organizer.lastName}</p>
        ${meeting.description ? `<p><strong>Description:</strong> ${meeting.description}</p>` : ''}
      </div>
      <p><a href="${meeting.meetingLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Join Meeting</a></p>
      <p>Best regards,<br>The Nexus Team</p>
    </div>
  `;

  return sendEmail({
    to: recipient.email,
    subject,
    text,
    html
  });
};

// Send document notification
export const sendDocumentNotification = async (document, recipient, action = 'shared') => {
  const subject = `Document ${action}: ${document.title}`;
  const text = `A document has been ${action} with you: ${document.title}\n\nUploaded by: ${document.uploadedBy.firstName} ${document.uploadedBy.lastName}\n\nClick here to view: https://nexus.com/documents/${document._id}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Document ${action}</h2>
      <p>A document has been ${action} with you on Nexus.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>${document.title}</h3>
        <p><strong>Uploaded by:</strong> ${document.uploadedBy.firstName} ${document.uploadedBy.lastName}</p>
        <p><strong>Category:</strong> ${document.category}</p>
        <p><strong>File size:</strong> ${document.fileSizeFormatted}</p>
        ${document.description ? `<p><strong>Description:</strong> ${document.description}</p>` : ''}
      </div>
      <p><a href="https://nexus.com/documents/${document._id}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document</a></p>
      <p>Best regards,<br>The Nexus Team</p>
    </div>
  `;

  return sendEmail({
    to: recipient.email,
    subject,
    text,
    html
  });
};

// Send payment notification
export const sendPaymentNotification = async (transaction, recipient) => {
  const isSender = transaction.sender._id.toString() === recipient._id.toString();
  const amount = transaction.amount.toFixed(2);
  
  const subject = `Payment ${isSender ? 'Sent' : 'Received'}: $${amount}`;
  const text = `You have ${isSender ? 'sent' : 'received'} a payment of $${amount}\n\n${isSender ? 'To:' : 'From:'} ${isSender ? transaction.receiver.firstName : transaction.sender.firstName} ${isSender ? transaction.receiver.lastName : transaction.sender.lastName}\n\nTransaction ID: ${transaction._id}\nStatus: ${transaction.status}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Payment ${isSender ? 'Sent' : 'Received'}</h2>
      <p>You have ${isSender ? 'sent' : 'received'} a payment on Nexus.</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>$${amount} ${transaction.currency.toUpperCase()}</h3>
        <p><strong>${isSender ? 'To:' : 'From:'}</strong> ${isSender ? transaction.receiver.firstName : transaction.sender.firstName} ${isSender ? transaction.receiver.lastName : transaction.sender.lastName}</p>
        <p><strong>Transaction ID:</strong> ${transaction._id}</p>
        <p><strong>Status:</strong> ${transaction.status}</p>
        <p><strong>Date:</strong> ${transaction.createdAt.toLocaleDateString()}</p>
        ${transaction.description ? `<p><strong>Description:</strong> ${transaction.description}</p>` : ''}
      </div>
      <p><a href="https://nexus.com/transactions/${transaction._id}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Transaction</a></p>
      <p>Best regards,<br>The Nexus Team</p>
    </div>
  `;

  return sendEmail({
    to: recipient.email,
    subject,
    text,
    html
  });
};

// Send 2FA code
export const send2FACode = async (user, code) => {
  const subject = 'Your 2FA Code - Nexus';
  const text = `Your 2FA code is: ${code}\n\nThis code will expire in 10 minutes.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your 2FA Code</h2>
      <p>Here is your 2FA code for Nexus:</p>
      <div style="background: #007bff; color: white; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; border-radius: 5px; margin: 20px 0;">
        ${code}
      </div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please ignore this email.</p>
      <p>Best regards,<br>The Nexus Team</p>
    </div>
  `;

  return sendEmail({
    to: user.email,
    subject,
    text,
    html
  });
};

export default {
  sendEmail,
  sendWelcomeEmail,
  sendMeetingInvitation,
  sendDocumentNotification,
  sendPaymentNotification,
  send2FACode,
  generateOTP,
  generateToken
};
