const { getAuditQueue } = require('../queues/seo-audit');

class AuditEnqueueError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = 'AuditEnqueueError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function safeErrorMessage(error) {
  let message = error && error.message ? error.message : String(error);
  [process.env.REDIS_URL, process.env.DATABASE_URL].forEach((secret) => {
    if (secret) message = message.split(secret).join('[REDACTED]');
  });
  return message
    .replace(/rediss?:\/\/[^@\s]+@/gi, 'redis://[REDACTED]@')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@');
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

async function createOrReuseQueuedAudit(prisma, { url, clientId, websiteName }) {
  return prisma.$transaction(async (transaction) => {
    const client = await transaction.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });

    if (!client) {
      throw new AuditEnqueueError('The requested client does not exist.', 404, 'CLIENT_NOT_FOUND');
    }

    let website = await transaction.website.findFirst({
      where: { clientId, url },
      select: { id: true },
    });

    if (!website) {
      website = await transaction.website.create({
        data: { name: websiteName, url, clientId },
        select: { id: true },
      });
    }

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

async function enqueueAudit(input) {
  const validatedInput = validateEnqueueInput(input && input.url, input && input.clientId);
  let prisma;
  let queuedAudit;

  try {
    prisma = await getPrismaClient();
    queuedAudit = await createOrReuseQueuedAudit(prisma, validatedInput);
  } catch (error) {
    if (error instanceof AuditEnqueueError) throw error;

    console.error('Unable to prepare audit job:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
      message: safeErrorMessage(error),
    });
    throw new AuditEnqueueError('Unable to create or locate the audit record.', 500, 'DATABASE_ERROR');
  }

  try {
    const queue = getAuditQueue();
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
    console.error('Unable to enqueue audit job:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
      message,
    });

    try {
      await prisma.audit.updateMany({
        where: { id: queuedAudit.audit.id, status: 'QUEUED' },
        data: {
          status: 'FAILED',
          errorMessage: `Queue enqueue failed: ${message}`.slice(0, 2000),
        },
      });
    } catch (updateError) {
      console.error('Unable to mark unenqueued audit as failed:', {
        name: updateError && updateError.name ? updateError.name : 'Error',
        code: updateError && updateError.code ? updateError.code : null,
        message: safeErrorMessage(updateError),
      });
    }

    throw new AuditEnqueueError(
      'Unable to enqueue the audit job. The audit record was marked failed when possible.',
      503,
      'QUEUE_ERROR'
    );
  }
}

module.exports = { enqueueAudit, AuditEnqueueError, validateEnqueueInput };
