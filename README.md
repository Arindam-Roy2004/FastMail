# Email Job Scheduler

An email scheduler service and dashboard for the ReachInbox Software Development Intern assignment. It accepts email send requests through an API, stores them in PostgreSQL, schedules each email as a BullMQ delayed job (no cron), sends through Ethereal SMTP from multiple senders, and survives server restarts without losing or repeating emails. The React dashboard follows the provided Figma: Google login, Scheduled and Sent emails, and Compose.

Live: https://scheduler.royarindam.page

## Demo video

https://github.com/user-attachments/assets/2f960758-9b9f-45c5-b245-0efe7fd72de5

The video (under 5 minutes) shows:

- creating scheduled emails from the frontend
- the dashboard with Scheduled and Sent emails
- a restart scenario: the server is stopped and started again, and future emails are still sent, each once
- rate limiting and delay under load, with the Slack notification when a sender hits its hourly limit

## How to run the backend (Express, Redis, DB, BullMQ worker)

You need Node 22 or newer and Docker.

```bash
# PostgreSQL 16, Redis 7 (AOF persistence on) and Elasticsearch 8
docker compose up -d

cd backend
cp env.example .env          # fill in the values, see "Ethereal Email and environment variables"
npm install                  # also generates the Prisma client
npx prisma migrate deploy    # create the tables
npm run dev                  # Express API on http://localhost:4000
npm run worker               # BullMQ worker, in a second terminal
```

The API and the worker are separate processes, so the worker can be stopped, restarted or scaled without touching the API. The compose file maps Postgres to port 5433 and Redis to 6380, so it can run next to a local install of either.

Other backend commands:

```bash
npm test             # 36 tests: slot planner, Redis rate limiter, processor, DTOs, HTML sanitiser, admin emails
npm run typecheck
npm run reindex      # rebuild the Elasticsearch index from Postgres
```

## How to run the frontend

```bash
cd frontend
cp env.example .env.local    # set VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                  # http://localhost:5173
```

The Vite dev server proxies `/api` and `/admin` to the API, so the browser only talks to one origin.

Other frontend commands: `npm test` (7 tests for CSV parsing and address rules), `npm run lint`, `npm run build`.

## Ethereal Email and environment variables

**Ethereal needs no manual setup.** In Compose, open the From menu and choose **Add Ethereal sender**. The server creates a fresh Ethereal test inbox and stores its SMTP credentials. Add two or more senders and pick **All senders (rotate)** to spread a campaign across them. Each sent email has a **View the delivered message in Ethereal** link on its detail page. Existing Ethereal credentials can also be added with `POST /api/senders` (`mode: "manual"`). The host is fixed to `smtp.ethereal.email`, so the API cannot be used to relay mail anywhere else.

All variables are listed in [backend/env.example](backend/env.example) with comments. The ones you must set:

| Variable | What it is |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ random characters each (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A Google OAuth **Web** client. Add `http://localhost:5173` as an authorised JavaScript origin. The frontend needs the same client ID in `VITE_GOOGLE_CLIENT_ID`. |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` | A Slack app with the `incoming-webhook` scope. Slack only accepts HTTPS redirect URLs, so locally point a tunnel at the API (`cloudflared tunnel --url http://localhost:4000`) and use `https://<tunnel>/api/slack/callback`, which must also be listed in the Slack app's Redirect URLs. |
| `ADMIN_EMAILS` | Comma-separated emails allowed to open the queue dashboard. Empty means nobody. |

The scheduler settings have defaults and are all configurable:

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | Jobs the worker runs in parallel |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | 2000 | Minimum gap between two sends from the same sender |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 200 | Hourly limit per sender |
| `MAX_RECIPIENTS_PER_REQUEST` | 5000 | Largest campaign accepted in one request |
| `JOB_LOCK_MS` | 60000 | How long a worker may hold a job before it counts as stalled |

All values are validated at startup, and the process refuses to start with a readable message if one is wrong. Google and Slack are optional at startup: their routes answer 503 until they are configured.

## Architecture overview

```
POST /api/emails/schedule
  validate -> plan send times -> one Postgres transaction -> BullMQ delayed jobs -> index in Elasticsearch
                                                                     |
worker (separate process, concurrency N)                             v
  claim the row -> reserve a slot in Redis -> send now, or move the job to its slot -> record the result
```

### How scheduling works

1. **Validate.** Every request body, query and route parameter goes through a strict zod schema. Unknown keys are rejected, so a client can never set fields like `userId` or `status`. Recipients are trimmed, lower-cased and de-duplicated, and the HTML body is sanitised.
2. **Plan the send times** (`slot-planner.ts`). Senders are assigned round-robin. Each email is planned at `startTime + position × delay`. When a sender's hour is full, its next email moves to the start of the next hour with room, and the rest follow from there.
3. **Store, then queue.** The campaign and its email rows are written in one transaction. Only then are the BullMQ delayed jobs added, with `jobId` = the email id, `delay` = time until the planned slot, and 3 attempts with exponential backoff. Postgres is the source of truth, and a job never exists for an email that was not saved.
4. **Idempotent submit.** The compose page sends an idempotency key. Submitting the same request twice (double click, retry after a timeout) returns the first campaign and creates nothing new.

The job payload is only the email id. Recipients, subject and body are read from Postgres when the job runs.

### How persistence on restart is handled

- **Delayed jobs are stored in Redis with AOF persistence on.** Their fire times survive a restart of the API, the worker or Redis itself. Jobs that became due while the worker was down run as soon as it is back.
- **Emails are not duplicated.** The worker claims an email with a conditional update (`scheduled` → `sending`). Only one worker can win, so a job delivered twice, or two workers racing, still sends once. An email already marked `sent` makes its job a no-op.
- **Nothing restarts from scratch.** At startup (once, never on a timer) the API and the worker reconcile Postgres with Redis. Emails left in `sending` by a crashed worker go back to `scheduled`, and every `scheduled` email without a live job gets its job re-added at its original time.
- **Graceful shutdown.** On SIGINT or SIGTERM the worker stops taking new jobs and lets in-flight sends finish.

Tested as in the demo: schedule emails for a minute ahead, stop the API and the worker, restart Redis, wait until the emails are overdue, then start everything again. Each email was sent once, right away.

### How rate limiting and concurrency are implemented

**Delay between emails: minimum 2 seconds between sends, per sender** (`MIN_DELAY_BETWEEN_EMAILS_MS`). A campaign can ask for a longer delay, never a shorter one.

**Emails per hour: per sender** (`MAX_EMAILS_PER_HOUR_PER_SENDER`, default 200 per clock hour). A campaign can set a lower limit, and the smaller of the two applies. The counter is shared by every campaign that uses the same sender.

Both are enforced with **Redis counters, not in-memory counts**, by one Lua script per email (`rate-limiter.ts`):

- Keys are per sender and hour window: `rl:{sender}:count:{hour}` and `rl:{sender}:last:{hour}`.
- The script finds the earliest moment that is at least the minimum delay after the sender's previous send, in an hour that still has room, reserves that slot and returns it.
- Redis runs the script atomically, so workers on different machines can never take the same slot or the last slot of an hour twice.

**When the hourly limit is reached**, the job is not dropped or failed. The worker moves it back to the delayed set for its reserved slot in the next hour window with room. Slots are handed out in arrival order, so the campaign keeps its order. A deferral does not count as a failed attempt.

**Concurrency.** The worker runs `WORKER_CONCURRENCY` jobs in parallel. Running several jobs at once is safe because the claim step and the Redis slot reservation are both atomic.

**Why not BullMQ's built-in `limiter`.** It limits the whole queue, so one job per 2 seconds would cap every sender together at 1,800 emails an hour and make concurrency pointless. With per-sender limits, different senders send in parallel while each one keeps its own gap and hourly limit.

**Behaviour under load (1000+ emails at once).** 1000 emails for one sender at 200 an hour were accepted in under a second and planned as exactly 200 per hour over five hours, in order, all visible as delayed jobs in the BullMQ dashboard. With several senders the same campaign finishes proportionally sooner.

**Slack notification on rate limit hit.**
- **Connecting:** the user clicks Connect Slack, goes through Slack's real OAuth flow, and the backend stores the incoming webhook for that user.
- **The alert:** when a sender takes the last slot of an hour, the worker posts to Slack. Exactly one alert is sent per sender per hour, even with several workers, because the first worker to set a Redis key wins.
- **Not connected:** with no Slack connection the alert is skipped and nothing breaks. If the user connects later, alerts start without a redeploy.
- **App removed:** if Slack reports the app or channel is gone, the stored webhook is deleted and the dashboard offers Connect Slack again.

### Project structure

```
backend/
  server.ts, worker.ts        entry points: the API and the worker
  src/common/                 env validation, Prisma, Redis, Elasticsearch, errors, validation middleware
  src/modules/
    auth/                     Google login, sessions (access token + rotating httpOnly refresh cookie)
    sender/, mail/            Ethereal senders, SMTP mailer
    email/                    schedule, list, counts, detail, search
    queue/                    planner, Redis rate limiter, processor, reconcile, Bull Board
    slack/                    OAuth, status, test message, notifier
  tests/
frontend/src/
  components/ui/              reusable UI: button, menus, popover, tooltip, status pill, skeleton, empty state, dialogs
  components/site/            app shell, sidebar, account card, route guard
  features/                   auth, emails (lists, detail), compose, senders, slack
  lib/                        API wrapper, formatting, CSV parsing, hooks
```

## Features implemented

### Backend

| Requirement | Implementation |
|---|---|
| Accept email scheduling requests via API | `POST /api/emails/schedule` |
| Store them in a relational DB | PostgreSQL 16 with Prisma (`prisma/schema.prisma`) |
| Scheduler: BullMQ delayed jobs, no cron | `modules/queue/email.queue.ts`; reconcile runs once at startup only |
| Multiple senders via Ethereal SMTP | `modules/sender`, `modules/mail/mailer.ts` |
| Emails searchable via Elasticsearch | Indexed on schedule, send, failure and reschedule; `GET /api/emails/search` |
| Live BullMQ dashboard | Bull Board at `/admin/queues`, read-only, limited to `ADMIN_EMAILS` |
| Persistence: future emails still sent after a restart | Redis with AOF, reconcile at startup |
| Persistence: no duplicates, no restart from scratch | Conditional claim per email, idempotent submit, graceful shutdown |
| Concurrency: configurable worker concurrency | `WORKER_CONCURRENCY` |
| Rate limiting: minimum delay between sends | 2 seconds per sender, enforced in Redis |
| Rate limiting: emails per hour, safe across workers | Redis counters per sender and hour window; overflow moved to the next hour |
| Slack notification on rate limit hit | Slack OAuth, incoming webhook, one alert per sender per hour |

### Frontend

| Requirement | Implementation |
|---|---|
| Login: real Google OAuth, then redirect to the dashboard | Google sign-in popup; the code is exchanged and verified by the API |
| Header with user's name, email, avatar and Logout | Account card at the top of the sidebar, with a menu for Slack, the queue dashboard and Logout |
| Dashboard: Scheduled Emails and Sent Emails | Sidebar sections with live counts |
| "Compose New Email" button | Compose button in the sidebar |
| Compose: subject and body | Subject field and rich-text editor |
| Compose: upload a CSV/text file of leads and show the count | **Upload List** shows "N email addresses detected, N duplicates skipped" |
| Compose: start time, delay between emails, hourly limit | **Send Later** popover for the start time; delay (seconds) and hourly limit fields |
| Scheduled Emails table: email, subject, scheduled time, status | Scheduled list |
| Sent Emails table: email, subject, sent time, status (sent / failed) | Sent list |
| Loading states, empty states, error handling | Skeleton rows, empty states, toasts and inline field errors |

Also included: search as you type, a status filter, an email detail page, and lists that update while emails are being sent.

## Assumptions, shortcuts and trade-offs

- **Google login only.** The Figma's login card also has email and password fields. The assignment asks for Google login, so only the Google button is implemented.
- **User info sits in the sidebar.** The assignment mentions a top header; the Figma places the name, email, avatar and logout in the sidebar's account card, so they are there.
- **Sent time placement.** The Figma's Sent row has no time column, so the sent time is shown in small text beside the star.
- **Empty delay and hourly limit fields** mean the server defaults: 2 seconds and 200 per hour.
- **Delay is entered in seconds** in the dashboard and sent to the API in milliseconds.
- **Attachments, starring, archive and delete** appear in the Figma but are not part of the assignment. They are shown disabled with a tooltip.
- **Hour windows are clock hours in UTC**, which keeps the counter keys identical across machines.
- **At-least-once in one narrow case.** If a worker crashes after Ethereal accepts a message but before the email is marked `sent`, that email can be sent twice on retry. The claim step keeps this window very small, and every copy carries the same `Message-ID`.
- **Single Redis node.** The rate-limit script builds its keys inside Lua, which is fine on one Redis node. A Redis cluster would need a hash tag per sender.
