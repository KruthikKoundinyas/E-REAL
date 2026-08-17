# E-REAL — Email Scheduler

Full-stack email scheduling app with persistent job queues, rate limiting, and concurrency control.

**Tech stack:** Express, BullMQ, Redis, PostgreSQL, Next.js, Docker

---

## Quick Start (Docker)

```bash
git clone https://github.com/KruthikKoundinyas/E-REAL.git
cd E-REAL

# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start everything
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

Stop with `docker compose down` (add `-v` to wipe database and Redis data).

---

## Running Without Docker

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, JWT_SECRET

npm run dev   # starts Express + BullMQ worker
```

Runs on port 3001. On startup it connects to PostgreSQL (auto-creates tables), connects to Redis, starts the BullMQ worker, and restores any pending scheduled emails from the database.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env

npm run dev
```

Runs on port 3000.

---

## Ethereal Email Setup

[Ethereal](https://ethereal.email) is a fake SMTP service — emails get captured but never actually delivered.

**Auto mode (default):** Just leave the `SMTP_*` variables empty. The backend auto-creates an Ethereal test account on startup and prints the credentials:

```
Ethereal Email credentials:
  User: abc123@ethereal.email
  Pass: xyzpassword
  Preview URL: https://ethereal.email/login
```

Use those to log in at https://ethereal.email and see captured emails.

**Manual setup:** Create an account at https://ethereal.email, then set these in `backend/.env`:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-user@ethereal.email
SMTP_PASS=your-password
SMTP_FROM="Email Scheduler" <your-user@ethereal.email>
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for JWT tokens |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection |
| `PORT` | No | `3001` | Server port |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin |
| `SMTP_HOST` | No | Auto (Ethereal) | SMTP host |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | Auto (Ethereal) | SMTP user |
| `SMTP_PASS` | No | Auto (Ethereal) | SMTP password |
| `WORKER_CONCURRENCY` | No | `5` | Parallel email jobs |
| `RATE_LIMIT_EMAILS_PER_MINUTE` | No | `10` | Worker rate limit |
| `RATE_LIMIT_MAX` | No | `30` | API requests/min/IP |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001/api` | Backend URL |

---

## Architecture Overview

```
  Next.js         Express          PostgreSQL
  Frontend  --->  Backend    <-->  Database
  :3000           :3001
                    |
                    | enqueue jobs
                    v
                  BullMQ     <-->  Redis
                  Worker           (queue store)
                    |
                    | send
                    v
                  Ethereal
                  SMTP
```

### How Scheduling Works

1. User fills in the compose form and picks a future date/time.
2. Frontend calls `POST /api/emails/schedule`.
3. Backend saves the email to PostgreSQL (status = `scheduled`) and adds a delayed job to the BullMQ queue. The delay = `scheduledAt - now` in milliseconds.
4. When the delay expires, BullMQ hands the job to the worker.
5. Worker sends the email via Nodemailer, then updates the DB status to `sent` (or `failed`).

### Persistence on Restart

PostgreSQL is the source of truth, BullMQ/Redis is just the execution engine.

If the server stops, delayed jobs in Redis might be lost. So on every startup, a recovery step runs:

1. Queries the DB for emails that are still `scheduled` and haven't passed their send time.
2. Checks if each one already has a BullMQ job (by ID).
3. Re-enqueues any missing ones with the correct remaining delay.
4. Marks emails whose scheduled time passed during downtime as `failed`.

So you can stop the server, start it again, and future emails still send on time.

### Rate Limiting & Concurrency

**API level** (Express):
- Auth endpoints: 10 requests per 15 minutes (prevents brute force)
- Email endpoints: 30 requests per minute per IP
- Returns 429 when exceeded

**Worker level** (BullMQ):
- Processes at most 10 emails per minute (`limiter`)
- Runs up to 5 jobs in parallel (`concurrency`)
- Prevents SMTP overload and thundering herd after restarts

Both are configurable through env variables.

---

## Features

### Backend

- **Scheduler** — BullMQ delayed jobs with `delay = scheduledAt - now`
- **Persistence** — PostgreSQL stores all emails; missing jobs restored on restart
- **Rate Limiting** — API: express-rate-limit, Worker: BullMQ limiter (10/min)
- **Concurrency** — Worker runs up to 5 jobs in parallel
- **Auth** — JWT tokens with bcrypt password hashing
- **Retry** — Failed jobs retry 3 times with exponential backoff
- **Health Check** — `GET /api/health` for monitoring

### Frontend

- **Login / Register** — JWT auth, token in localStorage
- **Dashboard** — Stats cards (scheduled, sent, failed) + email tables
- **Compose** — Form with recipient, subject, body, datetime picker
- **Scheduled Emails Table** — Shows pending emails
- **Sent Emails Table** — Shows delivered emails with timestamps
- **Auth Guard** — Redirects to login if not authenticated
- **Responsive** — Tailwind CSS, works on mobile

---

## API Endpoints

All endpoints except auth need `Authorization: Bearer <token>`.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | `{ email, password }` | Create account |
| POST | `/api/auth/login` | `{ email, password }` | Get JWT token |
| POST | `/api/emails/schedule` | `{ recipient, subject, body, scheduledAt }` | Schedule email |
| GET | `/api/emails?status=scheduled` | — | List emails (filter optional) |
| GET | `/api/emails/stats` | — | Get counts by status |
| GET | `/api/health` | — | Health check |

---

## Assumptions & Trade-offs

**Assumptions:**
- Single-server setup — worker runs in the same process as the API server
- Ethereal only — no real email delivery, but easy to swap SMTP credentials for production
- JWT stored in localStorage — fine for a demo, production should use httpOnly cookies
- All times in UTC

**Trade-offs:**
- Chose BullMQ over node-cron/Agenda because it has built-in delay, retry, rate limiting, and concurrency
- PostgreSQL as source of truth instead of relying on Redis persistence — more reliable for crash recovery
- In-memory API rate limiting instead of Redis-backed — works for single server but wouldn't scale to multiple instances
- No WebSocket for live updates — dashboard refreshes on page load, keeps things simple

**Known shortcuts:**
- No unit or integration tests
- No input validation library (would use zod in production)
- No email templates
- No pagination on list endpoints
- No forgot-password flow

---

## Project Structure

```
E-REAL/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js       # PostgreSQL connection + table setup
│   │   │   ├── redis.js          # Redis connection
│   │   │   └── email.js          # Nodemailer / Ethereal config
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT auth middleware
│   │   │   └── rateLimiter.js    # Rate limit config
│   │   ├── routes/
│   │   │   ├── auth.js           # Login, register
│   │   │   └── emails.js         # Schedule, list, stats
│   │   ├── services/
│   │   │   └── emailService.js   # Scheduling + restore logic
│   │   ├── workers/
│   │   │   └── emailWorker.js    # BullMQ worker
│   │   └── index.js              # Entry point
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.js
│   │   │   ├── page.js
│   │   │   ├── globals.css
│   │   │   ├── login/page.js
│   │   │   ├── register/page.js
│   │   │   ├── dashboard/page.js
│   │   │   └── compose/page.js
│   │   ├── components/
│   │   │   └── Navbar.js
│   │   └── lib/
│   │       ├── api.js
│   │       └── useAuth.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.mjs
│   └── package.json
├── docker-compose.yml
├── .gitignore
└── README.md
```
