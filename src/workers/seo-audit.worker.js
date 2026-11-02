const { Worker } = require('bullmq');
const {
  QUEUE_NAME,
  createRedisConnection,
  getAuditQueue,
  closeAuditQueue,
} = require('../queues/seo-audit');

function safeErrorMessage(error) {
  let message = error && error.message ? error.message : String(error);
  [process.env.REDIS_URL, process.env.DATABASE_URL, process.env.ANTHROPIC_API_KEY].forEach((secret) => {
    if (secret) message = message.split(secret).join('[REDACTED]');
  });
  return message
    .replace(/rediss?:\/\/[^@\s]+@/gi, 'redis://[REDACTED]@')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, 'postgresql://[REDACTED]@')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[REDACTED]');
}

async function getPrismaClient() {
  const prismaModule = await import('../lib/prisma.js');
  return prismaModule.prisma;
}

async function startAuditAttempt(prisma, { auditId, clientId }) {
  return prisma.$transaction(async (transaction) => {
    const audit = await transaction.audit.findUnique({
      where: { id: auditId },
      include: { website: { select: { clientId: true } } },
    });

    if (!audit) {
      throw new Error(`Audit "${auditId}" was not found.`);
    }

    if (audit.website.clientId !== clientId) {
      throw new Error('Audit client does not match the queued job.');
    }

    if (audit.status === 'COMPLETED') {
      return { alreadyCompleted: true };
    }

    await transaction.auditIssue.deleteMany({ where: { auditId } });
    await transaction.auditRecommendation.deleteMany({ where: { auditId } });
    await transaction.report.deleteMany({ where: { auditId } });
    await transaction.audit.update({
      where: { id: auditId },
      data: {
        status: 'PROCESSING',
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
      },
    });

    return { alreadyCompleted: false };
  });
}

async function markAuditFailed(prisma, auditId, error) {
  const message = safeErrorMessage(error).slice(0, 2000);
  try {
    await prisma.audit.updateMany({
      where: { id: auditId, status: { not: 'COMPLETED' } },
      data: {
        status: 'FAILED',
        errorMessage: message,
        completedAt: null,
      },
    });
  } catch (updateError) {
    console.error('Unable to mark audit as failed:', {
      auditId,
      name: updateError && updateError.name ? updateError.name : 'Error',
      code: updateError && updateError.code ? updateError.code : null,
      message: safeErrorMessage(updateError),
    });
  }
}

async function processAuditJob(job) {
  const { auditId, url, clientId } = job.data || {};
  if (
    typeof auditId !== 'string' ||
    typeof url !== 'string' ||
    typeof clientId !== 'string'
  ) {
    throw new Error('Audit job must include auditId, url, and clientId.');
  }

  const prisma = await getPrismaClient();
  try {
    const attempt = await startAuditAttempt(prisma, { auditId, clientId });
    if (attempt.alreadyCompleted) {
      console.info('Audit job skipped because audit is already complete.', {
        auditId,
        jobId: job.id,
      });
      return { auditId, status: 'COMPLETED', skipped: true };
    }

    console.info('Audit processing started.', {
      auditId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
    });

    const { runAudit } = require('../services/audit');
    const result = await runAudit(url, { clientId, auditId });

    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        errorMessage: null,
        completedAt: new Date(),
      },
    });

    console.info('Audit processing completed.', { auditId, jobId: job.id });
    return { auditId, status: 'COMPLETED', result };
  } catch (error) {
    await markAuditFailed(prisma, auditId, error);
    console.error('Audit processing attempt failed.', {
      auditId,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      message: safeErrorMessage(error),
    });
    throw error;
  }
}

async function startWorker() {
  const connection = createRedisConnection();
  const queue = getAuditQueue();
  const worker = new Worker(QUEUE_NAME, processAuditJob, {
    connection,
    concurrency: 1,
  });

  connection.on('error', (error) => {
    console.error('Audit worker Redis connection error:', safeErrorMessage(error));
  });

  worker.on('ready', () => {
    console.info(`Audit worker ready for queue "${QUEUE_NAME}".`);
  });
  worker.on('failed', (job, error) => {
    console.error('Audit job failed.', {
      auditId: job && job.data ? job.data.auditId : undefined,
      jobId: job ? job.id : undefined,
      attemptsMade: job ? job.attemptsMade : undefined,
      attempts: job && job.opts ? job.opts.attempts : undefined,
      message: safeErrorMessage(error),
    });
  });
  worker.on('error', (error) => {
    console.error('Audit worker error:', safeErrorMessage(error));
  });

  try {
    await Promise.all([worker.waitUntilReady(), queue.waitUntilReady()]);
  } catch (error) {
    await worker.close().catch(() => {});
    await closeAuditQueue().catch(() => {});
    if (connection.status !== 'end') await connection.quit().catch(() => {});
    throw new Error(`Audit worker could not connect to Redis: ${safeErrorMessage(error)}`);
  }

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`Audit worker shutting down after ${signal}.`);

    try {
      await worker.close();
      await closeAuditQueue();
      if (connection.status !== 'end') await connection.quit();
      const prisma = await getPrismaClient();
      await prisma.$disconnect();
      console.info('Audit worker shutdown complete.');
    } catch (error) {
      console.error('Audit worker shutdown failed:', safeErrorMessage(error));
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { worker, queue, connection, shutdown };
}

if (require.main === module) {
  startWorker().catch((error) => {
    console.error('Audit worker startup failed:', safeErrorMessage(error));
    process.exitCode = 1;
  });
}

module.exports = {
  processAuditJob,
  startAuditAttempt,
  markAuditFailed,
  startWorker,
};
