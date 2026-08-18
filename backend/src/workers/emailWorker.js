const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { pool } = require('../config/database');
const { getTransporter } = require('../config/email');
const nodemailer = require('nodemailer');
const { EMAIL_QUEUE_NAME } = require('../services/emailService');

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

      const transporter = await getTransporter();
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Email Scheduler" <scheduler@example.com>',
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<p>${email.body.replace(/\n/g, '<br>')}</p>`,
      });

      await pool.query(
        "UPDATE emails SET status = 'sent', sent_at = NOW() WHERE id = $1",
        [emailId]
      );

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`Email ${emailId} sent. Preview: ${previewUrl}`);
      }

      return { sent: true, messageId: info.messageId, previewUrl };
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
