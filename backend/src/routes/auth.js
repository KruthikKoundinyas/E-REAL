const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../schemas/auth');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );

    const token = jwt.sign({ userId: result.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ token, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
