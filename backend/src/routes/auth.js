const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production' || process.env.BACKEND_URL?.startsWith('https');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`
);

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://mail.google.com/',
];

router.get('/google', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!code) {
    return res.redirect(`${frontendUrl}/login?error=no_code`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name || '';
    const avatarUrl = payload.picture || '';

    let result = await pool.query('SELECT id, email FROM users WHERE google_id = $1', [googleId]);

    if (result.rows.length === 0) {
      result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);

      if (result.rows.length > 0) {
        await pool.query(
          `UPDATE users SET google_id = $1, name = $2, avatar_url = $3,
           google_access_token = $4, google_refresh_token = COALESCE($5, google_refresh_token)
           WHERE id = $6`,
          [googleId, name, avatarUrl, tokens.access_token, tokens.refresh_token, result.rows[0].id]
        );
      } else {
        result = await pool.query(
          `INSERT INTO users (email, google_id, name, avatar_url, google_access_token, google_refresh_token)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email`,
          [email, googleId, name, avatarUrl, tokens.access_token, tokens.refresh_token]
        );
      }
    } else {
      await pool.query(
        `UPDATE users SET name = $1, avatar_url = $2, google_access_token = $3,
         google_refresh_token = COALESCE($4, google_refresh_token)
         WHERE id = $5`,
        [name, avatarUrl, tokens.access_token, tokens.refresh_token, result.rows[0].id]
      );
    }

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, avatar_url FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
