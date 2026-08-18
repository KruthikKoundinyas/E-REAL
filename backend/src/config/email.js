const nodemailer = require('nodemailer');

let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Ethereal Email credentials:');
    console.log(`  User: ${testAccount.user}`);
    console.log(`  Pass: ${testAccount.pass}`);
    console.log(`  Preview URL: https://ethereal.email/login`);
  }

  return transporter;
}

module.exports = { getTransporter };
