# SEO Automation Dashboard

EDGELINK TECHNOLOGY SEO Automation Dashboard is a Next.js application for collecting website SEO signals, generating structured audit reports, and persisting audit history. The current frontend provides a live database-backed overview; client, website, audit-detail, and report-management screens are planned.

## Implemented features

- Website crawl for page title, meta description, headings, links, images, and JSON-LD.
- On-page analysis, Schema.org checks, and robots.txt/sitemap checks.
- PageSpeed, Google Search Console, and DataForSEO mock signal providers.
- Claude Sonnet 4.6 report generation with a deterministic signal-based mock provider and shared report validation.
- PostgreSQL persistence for audits, issues, and recommendations using Prisma.
- BullMQ audit queue and a separate persistent Node.js worker.
- Dashboard overview with database-backed client, website, audit, and score statistics, plus recent audits.
- API endpoints for health checks, audit enqueueing, dashboard statistics, and recent audits.

The PageSpeed, Google Search Console, and DataForSEO non-mock provider integrations are placeholders and are not implemented. The Claude REAL provider is implemented, but requires a valid API key. Live external service and production database/Redis behavior depends on your configuration and has not been verified by this repository setup.

## Technology stack

- Next.js 14 App Router, React 18, JavaScript
- Tailwind CSS
- Prisma 6 and PostgreSQL (for example, Supabase PostgreSQL)
- BullMQ and ioredis with Redis (for example, Upstash)
- Cheerio for HTML parsing
- Anthropic SDK for the Claude REAL provider

## Architecture

The audit flow is:

```text
Website crawl
  → SEO signal collection and analysis
  → Claude analysis (MOCK or REAL)
  → PostgreSQL persistence
  → Dashboard overview
```

`POST /api/audits` creates or reuses a queued audit and enqueues a BullMQ job in `seo-audit-jobs`. A separate Node.js worker consumes jobs, runs the existing audit service, and updates the audit lifecycle and related report data. The Next.js API process does not host the persistent worker.

The current dashboard overview is available at `/`. The sidebar marks Clients, Websites, Audits, and Reports as coming soon; these are not functional pages yet.

## Prerequisites

- Node.js 20.6 or newer (the worker npm scripts use Node's `--env-file` option)
- npm
- A PostgreSQL database for a configured deployment or local environment
- Redis for queueing and worker execution (an Upstash Redis database is supported)
- An Anthropic API key only when using Claude REAL mode

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and replace placeholders with your own configuration. Never commit `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

   See [Environment variables](#environment-variables) below.

3. Generate the Prisma client:

   ```bash
   npm run db:generate
   ```

   The production build also regenerates the client before invoking Next.js.

4. Apply the committed migrations to the configured database:

   ```bash
   npx prisma migrate deploy
   ```

   For a new local development migration, use `npx prisma migrate dev --name describe_change`. Do not use database reset commands on a database containing data.

## Environment variables

`.env.example` contains placeholders only. Set values in your local `.env` or deployment environment; do not put credentials in source control.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection used by Prisma. |
| `REDIS_URL` | For enqueueing and the worker | Redis connection URL. Use the `rediss://` URL provided by Upstash when using its TLS endpoint. |
| `USE_MOCKS` | Yes | Set to `true` to use the mock Claude and SEO signal providers; set to `false` to use Claude REAL mode. PageSpeed, GSC, and DataForSEO live integrations are not implemented yet. |
| `ANTHROPIC_API_KEY` | When `USE_MOCKS=false` | Anthropic API key for Claude Sonnet 4.6. No API key is needed for mock report generation. |

Never paste or commit actual credentials. Do not expose `.env` in bug reports or screenshots.

## Run the application and worker

Start the Next.js application in one terminal:

```bash
npm run dev
```

Start the audit worker in a separate terminal:

```bash
npm run worker
```

For development with automatic worker restarts:

```bash
npm run worker:dev
```

The worker must run continuously to consume queued jobs. Vercel serverless functions are request-scoped and are not suitable for hosting this persistent BullMQ worker; deploy the worker to a persistent Node.js environment separately from the Next.js app.

To enqueue an audit, use an existing Client ID:

```bash
curl -X POST http://localhost:3000/api/audits \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://example.com\",\"clientId\":\"YOUR_EXISTING_CLIENT_ID\"}"
```

The API responds with HTTP 202 and the audit/job identifiers when enqueueing succeeds.

## Prisma commands

```bash
npm run db:generate       # Generate the Prisma client
npx prisma migrate deploy # Apply committed migrations
npx prisma migrate status # Check migration status
```

The generated client is written to `src/generated/prisma`, ignored by Git, and regenerated by `npm run db:generate` and the production build.

## Planned / not implemented

- Authentication and authorization. **The dashboard is not access-controlled.** Do not deploy it publicly with sensitive data until access control is implemented.
- Client and website management UI and CRUD APIs.
- Audit listing, detail, and status-tracking APIs/pages.
- PDF generation, report file storage, and PDF download.
- Monthly audit scheduling/cron.
- Live PageSpeed Insights, Google Search Console, and DataForSEO integrations.
- Real Twilio notifications.
- Production monitoring and live Upstash/PostgreSQL deployment verification.

## Verification

```bash
npm run lint
npm run build
```
