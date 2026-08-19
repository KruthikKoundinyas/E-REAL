const express = require('express');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { scheduleEmailSchema, emailQuerySchema } = require('../schemas/email');
const { scheduleEmail, getUserEmails, getEmailStats, getEmailQueue } = require('../services/emailService');
const { pool } = require('../config/database');

const router = express.Router();

router.use(authenticate);
router.use(apiLimiter);

router.post('/schedule', validate(scheduleEmailSchema), async (req, res) => {
  try {
    const { recipient, subject, body, scheduledAt } = req.body;

    const email = await scheduleEmail({
      userId: req.userId,
      recipient,
      subject,
      body,
      scheduledAt: new Date(scheduledAt),
    });

    res.status(201).json(email);
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

router.get('/', async (req, res) => {
  try {
    const parsed = emailQuerySchema.parse(req.query);
    const emails = await getUserEmails(req.userId, parsed.status);
    res.json(emails);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid status filter', details: err.issues });
    }
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

router.post('/retry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "SELECT * FROM emails WHERE id = $1 AND user_id = $2 AND status = 'failed'",
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found or not retryable' });
    }

    const email = result.rows[0];
    const delay = Math.max(0, new Date(email.scheduled_at).getTime() - Date.now());
    const now = delay <= 0;

    await pool.query(
      "UPDATE emails SET status = 'scheduled', error_message = NULL, scheduled_at = $1 WHERE id = $2",
      [now ? new Date() : email.scheduled_at, id]
    );

    const queue = getEmailQueue();
    const existingJob = await queue.getJob(`email-${id}`);
    if (existingJob) await existingJob.remove();

    await queue.add(
      'send-email',
      { emailId: parseInt(id) },
      { delay: now ? 0 : delay, jobId: `email-${id}` }
    );

    res.json({ message: 'Email queued for retry' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retry email' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    if (result.rows[0].status === 'scheduled') {
      const { getEmailQueue } = require('../services/emailService');
      const queue = getEmailQueue();
      const existingJob = await queue.getJob(`email-${id}`);
      if (existingJob) await existingJob.remove();
    }

    await pool.query('DELETE FROM emails WHERE id = $1', [id]);
    res.json({ message: 'Email deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getEmailStats(req.userId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
