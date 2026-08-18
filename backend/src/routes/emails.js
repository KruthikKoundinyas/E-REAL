const express = require('express');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { scheduleEmailSchema, emailQuerySchema } = require('../schemas/email');
const { scheduleEmail, getUserEmails, getEmailStats } = require('../services/emailService');

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
      return res.status(400).json({ error: 'Invalid status filter', details: err.errors });
    }
    res.status(500).json({ error: 'Failed to fetch emails' });
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
