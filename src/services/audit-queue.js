const { getAuditQueue } = require('../queues/seo-audit');

class AuditEnqueueError extends Error {
  constructor(message, statusCode, code, { stage, websiteId, cause } = {}) {
    super(message);
    this.name = 'AuditEnqueueError';
    this.statusCode = statusCode;
    this.code = code;
    this.stage = stage || null;
    this.websiteId = websiteId || null;
    if (cause) this.cause = cause;
  }
}

function safeErrorMessage(error) {
  let message = error && error.message ? error.message : String(error);
  [
    process.env.REDIS_URL,
    process.env.DATABASE_URL,
    process.env.ANTHROPIC_API_KEY,
    process.env.CRON_SECRET,
  ].forEach((secret) => {
    if (secret) message = message.split(secret).join('[REDACTED]');
  });
  return message
    .replace(/rediss?:\/\/[^@\s]+@/gi, 'redis://[REDACTED]@')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^/\s:@]+:[^/\s@]+@/gi, 'https://[REDACTED]@')
    .slice(0, 1000);
}

function logEnqueueDiagnostic({ websiteId, stage, error }) {
  console.error('Audit enqueue operation failed:', {
    websiteId: websiteId || null,
    stage,
    errorName: error && error.name ? error.name : 'Error',
    errorCode: error && error.code ? error.code : null,
    prismaCode: error && typeof error.code === 'string' && /^P\d{4}$/.test(error.code)
      ? error.code
      : null,
    safeMessage: safeErrorMessage(error),
  });
}

function validateEnqueueInput(url, clientId) {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new AuditEnqueueError('clientId is required.', 400, 'INVALID_CLIENT_ID');
  }

  if (typeof url !== 'string' || !url.trim()) {
    throw new AuditEnqueueError('url is required.', 400, 'INVALID_URL');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new AuditEnqueueError('url must be a valid HTTP or HTTPS URL.', 400, 'INVALID_URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new AuditEnqueueError('url must use HTTP or HTTPS.', 400, 'INVALID_URL');
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new AuditEnqueueError('url must not contain embedded credentials.', 400, 'INVALID_URL');
  }

  return { url: parsedUrl.href, clientId: clientId.trim(), websiteName: parsedUrl.hostname };
}

async function getPrismaClient() {
  const prismaModule = await import('../lib/prisma.js');
  return prismaModule.prisma;
}

async function createOrReuseQueuedAudit(
  prisma,
  { url, clientId, websiteName },
  { monthlyWindow, onStage = () => {} } = {}
) {
  return prisma.$transaction(async (transaction) => {
    onStage('database.client_lookup');
    const client = await transaction.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new AuditEnqueueError('The requested client does not exist.', 404, 'CLIENT_NOT_FOUND');
    }

    onStage('database.website_lookup');
    let website = await transaction.website.findFirst({
      where: { clientId, url },
      select: { id: true },
    });
    if (website) onStage('database.website_lookup', website.id);

    if (!website) {
      onStage('database.website_create');
      website = await transaction.website.create({
        data: { name: websiteName, url, clientId },
        select: { id: true },
      });
      onStage('database.website_create', website.id);
    }

    if (monthlyWindow) {
      onStage('database.monthly_lock', website.id);
      await transaction.$queryRaw`
        SELECT 1::integer AS locked
        FROM pg_advisory_xact_lock(hashtextextended(${`monthly-audit:${website.id}`}, 0))
      `;

      onStage('database.monthly_audit_lookup', website.id);
      const monthlyAudit = await transaction.audit.findFirst({
        where: {
          websiteId: website.id,
          createdAt: {
            gte: monthlyWindow.monthStart,
            lt: monthlyWindow.nextMonthStart,
          },
        },
        select: { id: true, status: true },
      });

      if (monthlyAudit) {
        return { audit: monthlyAudit, isNew: false, alreadyScheduled: true };
      }
    }

    onStage('database.active_audit_lookup', website.id);
    const activeAudit = await transaction.audit.findFirst({
      where: {
        websiteId: website.id,
        status: { in: ['QUEUED', 'PROCESSING'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    if (activeAudit) {
      return { audit: activeAudit, isNew: false };
    }

    onStage('database.audit_create', website.id);
    const audit = await transaction.audit.create({
      data: {
        status: 'QUEUED',
        websiteId: website.id,
      },
      select: { id: true, status: true },
    });

    return { audit, isNew: true };
  });
}

async function enqueueAudit(
  input,
  {
    monthlyWindow,
    prisma: prismaOverride,
    queue: queueOverride,
    websiteId: requestedWebsiteId,
  } = {}
) {
  const validatedInput = validateEnqueueInput(input && input.url, input && input.clientId);
  let prisma;
  let queuedAudit;
  let stage = 'database.client';
  let websiteId = requestedWebsiteId || null;

  try {
    prisma = prismaOverride || await getPrismaClient();
    queuedAudit = await createOrReuseQueuedAudit(prisma, validatedInput, {
      monthlyWindow,
      onStage(nextStage, resolvedWebsiteId) {
        stage = nextStage;
        if (resolvedWebsiteId) websiteId = resolvedWebsiteId;
      },
    });
  } catch (error) {
    logEnqueueDiagnostic({
      websiteId,
      stage: error && error.stage ? error.stage : stage,
      error: error && error.cause ? error.cause : error,
    });
    if (error instanceof AuditEnqueueError) {
      error.websiteId = websiteId;
      error.stage = error.stage || stage;
      throw error;
    }

    throw new AuditEnqueueError(
      'Unable to create or locate the audit record.',
      500,
      'DATABASE_ERROR',
      { stage, websiteId, cause: error }
    );
  }

  if (queuedAudit.alreadyScheduled) {
    return {
      auditId: queuedAudit.audit.id,
      status: queuedAudit.audit.status,
      reused: true,
      monthlyDuplicate: true,
    };
  }

  stage = 'queue.enqueue';
  try {
    const queue = queueOverride || getAuditQueue();
    const job = await queue.add(
      'process-audit',
      {
        auditId: queuedAudit.audit.id,
        url: validatedInput.url,
        clientId: validatedInput.clientId,
      },
      { jobId: queuedAudit.audit.id }
    );

    return {
      auditId: queuedAudit.audit.id,
      jobId: job.id,
      status: queuedAudit.audit.status,
      reused: !queuedAudit.isNew,
    };
  } catch (error) {
    const message = safeErrorMessage(error);
    logEnqueueDiagnostic({ websiteId, stage, error });

    const failureStage = 'queue.mark_audit_failed';
    try {
      await prisma.audit.updateMany({
        where: { id: queuedAudit.audit.id, status: 'QUEUED' },
        data: {
          status: 'FAILED',
          errorMessage: `Queue enqueue failed: ${message}`.slice(0, 2000),
        },
      });
    } catch (updateError) {
      logEnqueueDiagnostic({ websiteId, stage: failureStage, error: updateError });
    }

    throw new AuditEnqueueError(
      'Unable to enqueue the audit job. The audit record was marked failed when possible.',
      503,
      'QUEUE_ERROR',
      { stage: 'queue.enqueue', websiteId, cause: error }
    );
  }
}

module.exports = {
  enqueueAudit,
  createOrReuseQueuedAudit,
  AuditEnqueueError,
  validateEnqueueInput,
};
