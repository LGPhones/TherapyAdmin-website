const nodemailer = require('nodemailer');

// Configure SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends a registration email
 * @param {string} email 
 * @param {string} verificationToken 
 */
async function sendVerificationEmail(email, verificationToken) {
  const mailOptions = {
    from: '"TherapyAdmin AI" <no-reply@therapyadmin.ai>',
    to: email,
    subject: 'Verify your account',
    text: `Please verify your account by visiting this link: ${process.env.APP_URL}/auth/verify?token=${verificationToken}`,
    html: `<p>Please verify your account by clicking the link below:</p>
           <a href="${process.env.APP_URL}/auth/verify?token=${verificationToken}">Verify Account</a>`,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
