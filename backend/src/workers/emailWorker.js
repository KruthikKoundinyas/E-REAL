const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const { pool } = require('../config/database');
const { OAuth2Client } = require('google-auth-library');
const { EMAIL_QUEUE_NAME } = require('../services/emailService');

async function getAccessToken(user) {
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: user.google_refresh_token,
  });
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

function buildRawEmail({ from, to, subject, textBody, htmlBody }) {
  const boundary = 'boundary_' + Date.now();
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
  ];
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
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

      const accessToken = await getAccessToken(user);

      const escapedBody = email.body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');

      const raw = buildRawEmail({
        from: user.email,
        to: email.recipient,
        subject: email.subject,
        textBody: email.body,
        htmlBody: `<p>${escapedBody}</p>`,
      });

      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Gmail API error: ${err.error?.message || response.statusText}`);
      }

      const data = await response.json();

      await pool.query(
        "UPDATE emails SET status = 'sent', sent_at = NOW() WHERE id = $1",
        [emailId]
      );

      console.log(`Email ${emailId} sent via Gmail API. MessageId: ${data.id}`);
      return { sent: true, messageId: data.id };
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
