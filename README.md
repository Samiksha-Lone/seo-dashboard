# EDGELINK SEO Automation Dashboard

A dashboard for managing clients and websites, running SEO audits, reviewing reports, and downloading audit PDFs.

## Features

- Admin and client portals with role- and ownership-scoped access.
- Client and website management.
- Background SEO audits with scores, findings, recommendations, and PDF reports.
- Login rate limiting and database-backed sessions.
- Monthly audit scheduling endpoint.

An admin queues an audit from a registered website. The API stores or reuses its audit record and queues a job in Redis. A separate worker crawls the site, runs SEO checks, saves results in PostgreSQL, generates a PDF, and records mock notification outcomes.

## Technology

- Next.js 14 App Router and React 18
- Node.js 22.12 or newer
- Tailwind CSS
- PostgreSQL with Prisma
- Redis with BullMQ
- Fetch and Cheerio for website crawling
- Anthropic Claude Sonnet 4.6 for report analysis
- Puppeteer for PDF generation

## Prerequisites

Install Node.js 22.12 or newer and npm. Provide a PostgreSQL database and Redis instance accessible by both the web app and worker.

## Setup

```bash
npm ci
```

Copy `.env.example` to `.env` and set `DATABASE_URL` and `REDIS_URL`. Keep `USE_MOCKS=true` for local development; replace the example values with your own configuration.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

Apply database migrations and generate Prisma Client:

```bash
npx prisma migrate deploy
npm run db:generate
```

To create the first administrator, set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run db:seed-admin
```

This command does not create another administrator if one already exists. Remove the initial password from `.env` after setup.

## Environment

See [`.env.example`](./.env.example) for all settings and safe example values.

- Required: `DATABASE_URL`, `REDIS_URL`.
- Optional: `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `TRUSTED_PROXY_IP_HEADER`, and `REPORT_STORAGE_DIR` (local storage only).
- Production PDF storage requires `SUPABASE_URL` and the server-side `SUPABASE_SECRET_KEY` (`sb_secret_...`) on both Vercel and Render.
- `USE_MOCKS` is set to `true` in `.env.example`; set it to `false` to use real Claude analysis.
- `ANTHROPIC_API_KEY` is needed only when `USE_MOCKS=false`.
- `CRON_SECRET` is needed only when using the monthly audit endpoint.
- `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` are only for initial administrator setup; `INITIAL_ADMIN_NAME` is optional.

Do not commit `.env` or real credentials.

## Run locally

Start the app and worker in separate terminals:

```bash
npm run dev
```

```bash
npm run worker
```

Open `http://localhost:3000`. Sign in at `/login`.

For a production build, run `npm run build` and then `npm run start`; keep the worker running separately.
For deployment, run the Next.js application and a persistent BullMQ worker, both with access to the same PostgreSQL database and Redis instance. The monthly scheduling endpoint also needs an external scheduler.

## Monthly scheduling

`POST /api/cron/monthly-audits` schedules audits for websites without an audit in the current UTC month. It requires `Authorization: Bearer <CRON_SECRET>`. Configure an external scheduler if needed; the project does not provision one. A running worker is still required to process queued jobs.

## Integrations and storage

PageSpeed, Google Search Console, DataForSEO, WhatsApp, and email integrations are mocks. WhatsApp and email do not send messages. Website crawling makes requests to registered sites. With `USE_MOCKS=true` as configured in `.env.example`, Claude uses a mock; set it to `false` to use the Anthropic API.

PDFs use local `.local-reports` storage in development and tests. Production uses the private Supabase Storage bucket `seo-reports`; the worker uploads PDFs, and the authenticated application issues a short-lived signed download URL after checking report ownership. Create the private bucket in Supabase before deployment and configure `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as server-only variables on both Vercel and Render. Never expose the secret key with a `NEXT_PUBLIC_` prefix.

## Tests and checks

```bash
npm test
npm run lint
npx prisma validate
npx next build
```
