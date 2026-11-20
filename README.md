# Email Job Scheduler

A small slice of what ReachInbox does under the hood: an API that accepts email campaigns, stores them in Postgres, schedules every email as a BullMQ delayed job (no cron anywhere), sends them through Ethereal SMTP from several senders, keeps to a per-sender gap and hourly limit across any number of workers, survives restarts without losing or repeating an email, and alerts Slack the moment a sender hits its hourly limit. A React dashboard built to the provided Figma sits on top: Google login, Scheduled and Sent mailboxes, search, and a compose page with CSV upload and Send Later.

This is my submission for the Software Development Intern assignment (Fullstack Email Job Scheduler).

## Demo video

https://github.com/user-attachments/assets/2f960758-9b9f-45c5-b245-0efe7fd72de5

It shows scheduling from the dashboard, the Scheduled and Sent lists updating live, a restart (API, worker and Redis stopped mid-schedule, emails still sent on time and once), and the hourly limit under load with the Slack alert.

## Run it

You need Node 22 or newer and Docker.

```bash
# 1. Postgres 16, Redis 7 (AOF on) and Elasticsearch 8
docker compose up -d

# 2. API and worker
cd backend
cp env.example .env          # then fill in the secrets, see below
npm install                  # also generates the Prisma client
npx prisma migrate deploy
npm run dev                  # API on http://localhost:4000
npm run worker               # in a second terminal: the BullMQ worker

# 3. Dashboard
cd ../frontend
cp env.example .env.local    # set VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                  # http://localhost:5173
```

The compose file maps Postgres to 5433 and Redis to 6380 so it can run next to a local install of either. The Vite dev server proxies `/api` and `/admin` to the API, so the browser only ever talks to one origin.

The API and the worker are separate processes on purpose. You can stop, restart or scale the worker without touching the API, which is also how the restart demo works.

Other commands:

```bash
cd backend
npm test             # node:test: planner, Redis rate limiter, processor, DTOs, HTML sanitiser
npm run typecheck
npm run reindex      # rebuild the Elasticsearch index from Postgres

cd frontend
npm test             # vitest: CSV parsing and address rules
npm run lint
npm run build
```

## Environment and Ethereal

Everything is in [backend/env.example](backend/env.example), with comments. The ones you must set:

| Variable | What it is |
|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | 32+ random characters each (`openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | A Google OAuth **Web** client. Add `http://localhost:5173` as an authorised JavaScript origin. The frontend needs the same client ID in `VITE_GOOGLE_CLIENT_ID`. |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` | A Slack app with the `incoming-webhook` scope. Slack only accepts HTTPS redirect URLs, so locally I point a tunnel at the API (`cloudflared tunnel --url http://localhost:4000`) and use `https://<tunnel>/api/slack/callback`, which must also be listed in the Slack app's Redirect URLs. |
| `ADMIN_EMAILS` | Comma-separated emails that may open the queue dashboard. Anyone can sign in with Google, so the dashboard is opt-in: empty means nobody. It is read-only for everyone. |

The scheduler settings have sensible defaults: `WORKER_CONCURRENCY=5`, `MIN_DELAY_BETWEEN_EMAILS_MS=2000`, `MAX_EMAILS_PER_HOUR_PER_SENDER=200`, `MAX_RECIPIENTS_PER_REQUEST=5000`, `JOB_LOCK_MS=60000`. They are validated with zod at boot, and the process refuses to start with a readable message if something is wrong. Google and Slack are optional at boot, so the API and worker run before those apps exist; their routes answer 503 until they are configured.

**Ethereal needs no setup.** In Compose, open the From menu and choose **Add Ethereal sender**. The server asks Ethereal for a fresh test inbox and stores its SMTP credentials. Add two or more and pick **All senders (rotate)** to spread a campaign across them. Every sent email has a **View the delivered message in Ethereal** link on its detail page. You can also paste existing Ethereal credentials with `POST /api/senders` (`mode: "manual"`); the host is pinned to `smtp.ethereal.email` so the API cannot be used as a relay.

## How scheduling works

```
POST /api/emails/schedule
  validate (zod, strict) -> plan send times -> one Postgres transaction -> BullMQ delayed jobs -> index in Elasticsearch
                                                                                  |
worker (separate process, concurrency N)                                          v
  claim the row -> reserve a slot in Redis (Lua) -> send now, or move the job to its slot -> record the result
```

1. **Validate.** Every request body, query and route param goes through a strict zod DTO. Unknown keys are rejected, so a client can never set `userId` or `status`. Errors come back with the exact path, such as `recipients.3`. Recipients are trimmed, lower-cased and de-duplicated, and the HTML body is sanitised to exactly what the editor can produce.
2. **Plan** (`slot-planner.ts`, a pure function). Senders are assigned round-robin. Each email would ideally go at `startAt + position * delay`. When a sender's hour is full, its next email moves to the start of the next hour with room, and the rest follow on from there. 1000 emails at 200 an hour become five hours of jobs up front, and no job wakes in an hour where it is not allowed to send.
3. **Store, then queue.** The campaign and its email rows are written in one transaction, and only then are the jobs added (`addBulk` in chunks of 500, `jobId` = the email id, `delay` = time until the slot, 3 attempts with exponential backoff). Postgres is always the source of truth, and a job can never exist for an email that was not saved.
4. **Idempotent submit.** The compose page creates an idempotency key when it opens. Sending the same request twice (double click, retry after a timeout) returns the first campaign and creates nothing new.

The job payload is only the email id. Recipients, subject and body are read from Postgres, so Bull Board and Redis never hold email content.

## What happens on restart

- **Delayed jobs live in Redis with AOF on**, so their fire times survive a restart of the API, the worker, or Redis itself. Jobs that came due while the worker was down run as soon as it is back.
- **No duplicates.** The worker claims a row with a conditional update (`scheduled -> sending`). Only one worker can win, so a job delivered twice, or two workers racing, still sends once. A row already `sent` makes the job a no-op.
- **Reconcile at boot** (`reconcile.ts`, once per boot of the API and of the worker, never on a timer). It puts `sending` rows abandoned by a crashed worker back to `scheduled`, and makes sure every `scheduled` row has a live job, re-adding any that are missing. If Redis had been wiped, every future email would be queued again at its original time.
- **Graceful shutdown.** On SIGINT or SIGTERM the worker stops taking jobs and lets in-flight sends finish.

I tested this the way the demo shows: schedule emails 20 seconds out, kill the API and the worker, restart the Redis container, wait until the emails are overdue, then start everything again. Each email was sent once, straight away.

The one window I cannot close from here: if a worker crashes after Ethereal accepts a message but before the row is marked `sent`, that one email can go out twice (at-least-once). The claim step makes the window small, and every copy carries the same deterministic `Message-ID`. Closing it fully would need deduplication on the provider's side.

## Rate limiting and concurrency

**The minimum gap between sends is 2 seconds per sender** (`MIN_DELAY_BETWEEN_EMAILS_MS`). A campaign can ask for a longer delay, never a shorter one.

**The hourly limit is per sender** (`MAX_EMAILS_PER_HOUR_PER_SENDER`, default 200 per clock hour). A campaign can set a lower limit; the effective limit is the smaller of the two. The counter is shared by every campaign that uses the same sender.

Both are enforced in **Redis**, not in memory, by one Lua script per email (`rate-limiter.ts`):

- Keys are `rl:{sender}:count:{hour}` and `rl:{sender}:last:{hour}`.
- Starting at the current hour, the script finds the earliest moment that is at least the gap after the sender's previous send, in an hour that still has room, takes that slot, and returns it.
- Redis runs a script without interleaving, so two workers on two machines can never take the same slot or the last one twice.

When the hour is full the job is **not failed or dropped**. The worker moves it back to the delayed set for its reserved slot in the next hour with room (`moveToDelayed` plus BullMQ's `DelayedError`). It wakes once, in the right hour, and sends. Slots are handed out in arrival order, so the campaign keeps its order. A deferral does not count as an attempt, and an email that fails for good gives its slot back.

**Why there is no BullMQ `limiter`.** A queue-wide limiter of one job per 2 seconds would cap every sender together at 1,800 emails an hour and make concurrency pointless. With the gap per sender, `WORKER_CONCURRENCY` jobs run in parallel and different senders really do send at the same time, while each sender still keeps its own gap.

**1000+ emails at once.** I scheduled 1000 emails for one sender at 200 an hour. The API answered in under a second, and the rows landed as exactly 200 per hour over five hours, in order. Bull Board showed them as delayed jobs. With several senders the same campaign finishes proportionally sooner.

**Slack alert.** When a reservation takes the last slot of an hour (or finds it already full), the worker sets `rl:{sender}:alert:{hour}` with `NX`. Only the first worker to win posts to Slack, so the alert arrives once per sender per hour, at the moment the limit is hit. The worker reads the Slack connection from Postgres at that moment: with no connection it quietly skips, and connecting later starts alerts with no restart. If Slack answers 404 or 410 (app removed, channel archived), the stored webhook is deleted and the dashboard offers Connect Slack again.

## Features mapped to the brief

**Backend**

| Requirement | Where |
|---|---|
| Accept scheduling requests via API | `POST /api/emails/schedule` (`modules/email`) |
| Relational DB | PostgreSQL 16 + Prisma (`prisma/schema.prisma`) |
| BullMQ delayed jobs, no cron | `modules/queue/email.queue.ts`; reconcile runs at boot only |
| Multiple senders via Ethereal | `modules/sender`, `modules/mail/mailer.ts` (pooled transport per sender) |
| Search via Elasticsearch | `modules/email/email.search.ts`: indexed on schedule, send, failure and reschedule; `GET /api/emails/search` |
| Live BullMQ dashboard | Bull Board at `/admin/queues`, read-only and limited to the emails in `ADMIN_EMAILS`; linked from the account menu for those users only |
| Survives restarts, no duplicates | AOF Redis, conditional claim, boot reconcile, graceful shutdown |
| Configurable worker concurrency | `WORKER_CONCURRENCY` |
| Minimum delay between sends | Per-sender gap in the Redis Lua script |
| Hourly limit, safe across workers | Redis counters per `sender + hour`, Lua, deferral into the next hour |
| Slack OAuth and alert on limit | `modules/slack`: OAuth v2 with signed state, incoming webhook, one alert per sender per hour |

**Frontend**

| Requirement | Where |
|---|---|
| Real Google login, then the dashboard | Google Identity Services code flow (popup), exchanged and verified on the server |
| Name, email, avatar, logout | The account card at the top of the sidebar (the Figma's header), with a menu for Slack, the queue dashboard and Logout |
| Scheduled and Sent sections | Sidebar items with live counts; one list component serves both |
| Compose New Email button | The outlined Compose button (or press `c`) |
| Subject, body, CSV/TXT upload with a count | Compose page; **Upload List** (or drop a file on the To row) shows "N email addresses detected, N duplicates skipped" |
| Start time, delay, hourly limit | **Send Later** popover (presets, date and time, time zone shown), delay in seconds, hourly limit |
| Tables with email, subject, time, status | Each row shows recipient, status pill, subject and preview. The scheduled time sits in the pill; the sent time sits beside the star |
| Loading, empty and error states | Skeleton rows, centred empty states, toasts, inline field errors mapped from the API |

I also added search as you type (including half-typed words), a status filter, an email detail page, polling so rows visibly move from Scheduled to Sent, keyboard shortcuts (`c` compose, `/` search, `Esc` back, `Cmd/Ctrl+Enter` send), and a confirm before discarding a draft.

## How it is put together

```
backend/
  server.ts, worker.ts        two entry points: the API and the worker
  src/common/                 env (zod), Prisma, Redis, Elasticsearch, errors, BaseDto, validation
  src/modules/
    auth/                     Google login, sessions (access token + rotating httpOnly refresh cookie)
    sender/, mail/            Ethereal senders, SMTP mailer
    email/                    schedule, list, counts, detail, search, HTML sanitising
    queue/                    planner, Redis rate limiter, processor, email store, reconcile, Bull Board
    slack/                    OAuth, status, test message, notifier
  tests/                      node:test
frontend/src/
  components/ui/              button, menus, popover, tooltip, pill, skeleton, empty state, dialogs
  components/site/            app shell, sidebar, account card, route guard
  features/                   auth, emails (lists, detail), compose, senders, slack
  lib/                        fetch wrapper with single-flight refresh, formatting, CSV parsing, hooks
```

- **Small interfaces at the edges.** The worker's processor is built from `createEmailProcessor({ store, mailer, limiter, notifier, indexer })`. Each dependency is a type with only the methods the processor calls. The worker passes the real Postgres, SMTP, Redis, Slack and Elasticsearch implementations, and the tests pass fakes, so retry, deferral and failure paths are tested without any of those services.
- **Pure core.** The planner, the CSV parser and the DTO schemas take data and return data, so they are tested directly.
- **What I left out on purpose.** There is no repository layer over Prisma (Prisma already is one) and no dependency-injection container. Plain function arguments do the same job at this size.

## Tests

- **Backend: 33 tests.** The planner covers order, spacing, hour overflow and 1000 emails at 200 an hour. The rate limiter runs against the real Redis and checks the limit under 50 concurrent callers, the gap, independent senders, release and the one-time alert. The processor covers sending, duplicates, busy rows, deferral, deferral on the last attempt, slot reuse, alerts, retry and final failure. The schedule DTO covers nested paths, unknown keys, header injection and limits. The HTML sanitiser has its own tests.
- **Frontend: 7 tests** for lead-list parsing (CRM exports, duplicates, invalid addresses) and the address rules shared with the API.
- I also ran the scenarios end to end against the running stack: restart, the hourly limit, retry with a broken SMTP password (three attempts, then `failed`, slot returned), a double submit, and 1000 emails at once.

## Assumptions and trade-offs

- **Google login only.** The Figma's login card also has email and password fields. The brief asks for Google login, so I built the card, the heading and the Google button and left the rest out.
- **The header lives in the sidebar.** The brief asks for user info and logout in a top header; the Figma puts them in the sidebar's account card, so that is where they are.
- **Sent time placement.** The brief wants a sent time column and the Figma's Sent pill has no time, so the time sits in small grey text beside the star.
- **Empty pacing fields** mean "as fast as the server allows": the 2 second gap and the 200 an hour ceiling. The success toast says which values were applied.
- **Attachments, starring, archive and delete** are drawn in the Figma but are not part of this brief. They are shown disabled with a tooltip rather than doing nothing silently.
- **Delay is entered in seconds** in the dashboard and sent to the API in milliseconds.
- **Hours are clock hours in UTC** for the limit, which keeps the counter keys simple and identical across machines.
- **At-least-once delivery** in one narrow crash window, as described under restart.
- **The rate-limit script builds its keys inside Lua**, which is fine on a single Redis node. A Redis cluster would need a hash tag per sender.

## Time spent

TODO: add how long this took.

## What I would do next

- Per-recipient personalisation (`{{firstName}}`) from the uploaded CSV columns.
- Campaign pause, resume and cancel, which the claim step already makes safe.
- Per-sender time zones and sending windows (for example 9 to 5 on weekdays).
- Bounce and reply tracking through a real provider's webhooks, which would also close the at-least-once window.
- A Redis cluster-safe key layout and a load test that runs the worker on several machines.
