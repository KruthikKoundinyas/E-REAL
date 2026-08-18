const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        recipient VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled',
        sent_at TIMESTAMP,
        error_message TEXT,
        bullmq_job_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
      CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
