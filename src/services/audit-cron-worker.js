const { Worker } = require('bullmq');
const {
  QUEUE_NAME,
  createRedisConnection,
} = require('../queues/seo-audit');
const { processAuditJob } = require('../workers/seo-audit.worker');
const { authorizeCronRequest } = require('./monthly-audits');

async function processNextAuditJob({
  authorization,
  secret = process.env.CRON_SECRET,
  WorkerClass = Worker,
  createConnection = createRedisConnection,
  processor = processAuditJob,
}) {
  const authorizationResult = authorizeCronRequest(authorization, secret);
  if (!authorizationResult.authorized) {
    return {
      status: authorizationResult.status,
      body: {
        processed: false,
        status: authorizationResult.status === 500 ? 'not_configured' : 'unauthorized',
        error: authorizationResult.status === 500
          ? 'Audit processing is not configured.'
          : 'Unauthorized.',
      },
    };
  }

  let connection;
  let worker;
  let activeJob;
  let pausePromise;
  let finishing = false;
  let resolveOutcome;

  const outcome = new Promise((resolve) => {
    resolveOutcome = resolve;
  });

  async function closeResources() {
    if (worker) await worker.close();
    if (connection && connection.status !== 'end') await connection.quit();
  }

  async function finish(result) {
    if (finishing) return;
    finishing = true;

    try {
      await closeResources();
      resolveOutcome(result);
    } catch (error) {
      console.error('Audit cron worker cleanup failed:', {
        name: error?.name || 'Error',
        code: error?.code || null,
      });
      resolveOutcome({
        status: 500,
        body: {
          processed: Boolean(activeJob),
          status: 'cleanup_failed',
          error: 'Audit worker cleanup failed.',
        },
      });
    }
  }

  try {
    connection = createConnection({ connectTimeout: 10_000 });
    worker = new WorkerClass(
      QUEUE_NAME,
      async (job) => {
        activeJob = activeJob || job;
        pausePromise = pausePromise || worker.pause(true);
        await pausePromise;
        return processor(job);
      },
      {
        connection,
        concurrency: 1,
        drainDelay: 1,
        autorun: false,
      }
    );

    worker.on('active', (job) => {
      if (!activeJob) {
        activeJob = job;
        pausePromise = pausePromise || worker.pause(true);
        pausePromise.catch((error) => {
          console.error('Audit cron worker pause failed:', {
            name: error?.name || 'Error',
            code: error?.code || null,
          });
        });
      }
    });

    worker.on('completed', (job) => {
      if (activeJob && job.id === activeJob.id) {
        void finish({
          status: 200,
          body: {
            processed: true,
            status: 'completed',
            jobId: job.id,
          },
        });
      }
    });

    worker.on('failed', (job) => {
      if (activeJob && job.id === activeJob.id) {
        void finish({
          status: 200,
          body: {
            processed: true,
            status: 'failed',
            jobId: job.id,
            retryScheduled: job.attemptsMade < job.opts.attempts,
          },
        });
      }
    });

    worker.on('drained', () => {
      if (!activeJob) {
        void finish({
          status: 200,
          body: { processed: false, status: 'empty' },
        });
      }
    });

    worker.on('error', (error) => {
      if (!activeJob) {
        console.error('Audit cron worker failed before claiming a job:', {
          name: error?.name || 'Error',
          code: error?.code || null,
        });
        void finish({
          status: 503,
          body: {
            processed: false,
            status: 'unavailable',
            error: 'Audit queue is temporarily unavailable.',
          },
        });
      }
    });

    let readinessTimeout;
    try {
      await Promise.race([
        worker.waitUntilReady(),
        new Promise((_, reject) => {
          readinessTimeout = setTimeout(
            () => reject(new Error('Audit worker readiness timed out.')),
            10_000
          );
        }),
      ]);
    } finally {
      clearTimeout(readinessTimeout);
    }
    worker.run().catch((error) => {
      console.error('Audit cron worker stopped unexpectedly:', {
        name: error?.name || 'Error',
        code: error?.code || null,
      });
      void finish({
        status: 503,
        body: {
          processed: Boolean(activeJob),
          status: 'unavailable',
          error: 'Audit queue is temporarily unavailable.',
        },
      });
    });

    return await outcome;
  } catch (error) {
    console.error('Audit cron worker startup failed:', {
      name: error?.name || 'Error',
      code: error?.code || null,
    });
    await closeResources().catch(() => {});
    return {
      status: 503,
      body: {
        processed: false,
        status: 'unavailable',
        error: 'Audit queue is temporarily unavailable.',
      },
    };
  }
}

module.exports = { processNextAuditJob };
