const { timingSafeEqual } = require('node:crypto');
const auditQueueService = require('./audit-queue');

function authorizeCronRequest(authorization, secret) {
  if (typeof secret !== 'string' || secret.length === 0) {
    return {
      authorized: false,
      status: 500,
      error: 'Monthly audit scheduling is not configured.',
    };
  }

  if (typeof authorization !== 'string') {
    return { authorized: false, status: 401, error: 'Unauthorized.' };
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { authorized: false, status: 401, error: 'Unauthorized.' };
  }

  const provided = Buffer.from(match[1].trim());
  const expected = Buffer.from(secret);
  const sameLength = provided.length === expected.length;
  const valid = sameLength && timingSafeEqual(provided, expected);
  if (!valid) {
    return { authorized: false, status: 401, error: 'Unauthorized.' };
  }

  return { authorized: true };
}

function getUtcMonthRange(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

function safeEnqueueFailure(error) {
  switch (error && error.code) {
    case 'CLIENT_NOT_FOUND':
    case 'INVALID_CLIENT_ID':
      return 'Associated client is unavailable.';
    case 'INVALID_URL':
      return 'Website URL is invalid.';
    case 'QUEUE_ERROR':
      return 'Audit queue is temporarily unavailable.';
    case 'DATABASE_ERROR':
      return 'Audit record could not be prepared.';
    default:
      return 'Audit could not be queued.';
  }
}

async function scheduleMonthlyAudits({
  prisma,
  enqueueAudit = auditQueueService.enqueueAudit,
  now = new Date(),
}) {
  const { monthStart, nextMonthStart } = getUtcMonthRange(now);
  const websites = await prisma.website.findMany({
    orderBy: { id: 'asc' },
    select: {
      id: true,
      url: true,
      client: { select: { id: true } },
      audits: {
        where: {
          createdAt: { gte: monthStart, lt: nextMonthStart },
        },
        take: 1,
        select: { id: true },
      },
    },
  });

  const summary = {
    totalWebsites: websites.length,
    queued: 0,
    skipped: 0,
    failed: 0,
  };
  const failures = [];

  for (const website of websites) {
    if (!website.client || typeof website.client.id !== 'string' || !website.client.id.trim()) {
      summary.skipped += 1;
      continue;
    }

    if (website.audits.length > 0) {
      summary.skipped += 1;
      continue;
    }

    try {
      await enqueueAudit({
        url: website.url,
        clientId: website.client.id,
      });
      summary.queued += 1;
    } catch (error) {
      summary.failed += 1;
      failures.push({
        websiteId: website.id,
        reason: safeEnqueueFailure(error),
      });
    }
  }

  return {
    success: true,
    message: 'Monthly audit scheduling completed',
    summary,
    ...(failures.length > 0 ? { failures } : {}),
  };
}

async function handleMonthlyAuditRequest({
  authorization,
  secret = process.env.CRON_SECRET,
  prisma,
  enqueueAudit = auditQueueService.enqueueAudit,
  now = new Date(),
}) {
  const authorizationResult = authorizeCronRequest(authorization, secret);
  if (!authorizationResult.authorized) {
    if (authorizationResult.status === 500) {
      console.error('Monthly audit scheduling is unavailable because CRON_SECRET is not configured.');
    }
    return {
      status: authorizationResult.status,
      body: { success: false, error: authorizationResult.error },
    };
  }

  try {
    const body = await scheduleMonthlyAudits({ prisma, enqueueAudit, now });
    return { status: 200, body };
  } catch (error) {
    console.error('Monthly audit website lookup failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
    });
    return {
      status: 500,
      body: {
        success: false,
        error: 'Unable to schedule monthly audits.',
      },
    };
  }
}

module.exports = {
  authorizeCronRequest,
  getUtcMonthRange,
  handleMonthlyAuditRequest,
  scheduleMonthlyAudits,
};
