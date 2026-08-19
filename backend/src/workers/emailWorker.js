const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer');
const { EMAIL_QUEUE_NAME } = require('../services/emailService');

function createOAuth2Transporter(user) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: user.email,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: user.google_refresh_token,
      accessToken: user.google_access_token,
    },
  });
}

function startEmailWorker() {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const { emailId } = job.data;

      const result = await pool.query('SELECT * FROM emails WHERE id = $1', [emailId]);
      if (result.rows.length === 0) {
        throw new Error(`Email ${emailId} not found`);
      }

      const email = result.rows[0];
      if (email.status !== 'scheduled') {
        return { skipped: true, reason: `Email status is ${email.status}` };
      }

      const userResult = await pool.query(
        'SELECT id, email, google_access_token, google_refresh_token FROM users WHERE id = $1',
        [email.user_id]
      );
      if (userResult.rows.length === 0) {
        throw new Error(`User ${email.user_id} not found`);
      }

      const user = userResult.rows[0];
      if (!user.google_refresh_token) {
        throw new Error('User has no Google credentials — please re-authenticate');
      }

      const transporter = createOAuth2Transporter(user);
      const escapedBody = email.body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');

      const info = await transporter.sendMail({
        from: user.email,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<p>${escapedBody}</p>`,
      });

      await pool.query(
        "UPDATE emails SET status = 'sent', sent_at = NOW() WHERE id = $1",
        [emailId]
      );

      console.log(`Email ${emailId} sent via Gmail OAuth. MessageId: ${info.messageId}`);
      return { sent: true, messageId: info.messageId };
    },
    {
      connection: getRedis(),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
      limiter: {
        max: parseInt(process.env.RATE_LIMIT_EMAILS_PER_MINUTE || '10'),
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed:`, result);
  });

  worker.on('failed', async (job, err) => {
    console.error(`Job ${job.id} failed:`, err.message);
    if (job) {
      const { emailId } = job.data;
      await pool.query(
        "UPDATE emails SET status = 'failed', error_message = $1 WHERE id = $2",
        [err.message, emailId]
      );
    }
  });

  console.log('Email worker started');
  return worker;
}

module.exports = { startEmailWorker };
