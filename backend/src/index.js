require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');
const { startEmailWorker } = require('./workers/emailWorker');
const { restoreScheduledEmails } = require('./services/emailService');
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  await initDatabase();
  await initRedis();
  startEmailWorker();
  await restoreScheduledEmails();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);
