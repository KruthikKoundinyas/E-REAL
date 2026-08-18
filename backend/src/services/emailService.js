const { Queue } = require('bullmq');
const { getRedis } = require('../config/redis');
const { pool } = require('../config/database');

const EMAIL_QUEUE_NAME = 'email-queue';

let emailQueue;

function getEmailQueue() {
  if (!emailQueue) {
    emailQueue = new Queue(EMAIL_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return emailQueue;
}

async function scheduleEmail({ userId, recipient, subject, body, scheduledAt }) {
  const result = await pool.query(
    `INSERT INTO emails (user_id, recipient, subject, body, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING *`,
    [userId, recipient, subject, body, scheduledAt]
  );

  const email = result.rows[0];
  const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now());

  const job = await getEmailQueue().add(
    'send-email',
    { emailId: email.id },
    { delay, jobId: `email-${email.id}` }
  );

  await pool.query(
    'UPDATE emails SET bullmq_job_id = $1 WHERE id = $2',
    [job.id, email.id]
  );

  email.bullmq_job_id = job.id;
  return email;
}

async function getUserEmails(userId, status) {
  let query = 'SELECT * FROM emails WHERE user_id = $1';
  const params = [userId];

  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }

  query += ' ORDER BY scheduled_at DESC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getEmailStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
       COUNT(*) FILTER (WHERE status = 'sent') as sent,
       COUNT(*) FILTER (WHERE status = 'failed') as failed,
       COUNT(*) as total
     FROM emails WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function restoreScheduledEmails() {
  const result = await pool.query(
    "SELECT * FROM emails WHERE status = 'scheduled' AND scheduled_at > NOW()"
  );

  const queue = getEmailQueue();
  let restored = 0;

  for (const email of result.rows) {
    const existingJob = await queue.getJob(`email-${email.id}`);
    if (!existingJob) {
      const delay = Math.max(0, new Date(email.scheduled_at).getTime() - Date.now());
      await queue.add(
        'send-email',
        { emailId: email.id },
        { delay, jobId: `email-${email.id}` }
      );
      restored++;
    }
  }

  if (restored > 0) {
    console.log(`Restored ${restored} scheduled emails to queue`);
  }

  await pool.query(
    "UPDATE emails SET status = 'failed', error_message = 'Missed scheduled time during downtime' WHERE status = 'scheduled' AND scheduled_at <= NOW()"
  );
}

module.exports = { scheduleEmail, getUserEmails, getEmailStats, restoreScheduledEmails, getEmailQueue, EMAIL_QUEUE_NAME };
