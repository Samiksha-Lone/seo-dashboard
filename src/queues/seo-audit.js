const { Queue } = require('bullmq');
const Redis = require('ioredis');

const QUEUE_NAME = 'seo-audit-jobs';
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5000,
  },
};

let producerConnection;
let auditQueue;

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required to use the SEO audit queue.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.');
  }

  if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol.');
  }

  return parsedUrl;
}

function createRedisConnection() {
  const redisUrl = getRedisUrl();
  return new Redis(redisUrl.toString(), {
    maxRetriesPerRequest: null,
    ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
  });
}

function getProducerConnection() {
  if (!producerConnection) {
    producerConnection = createRedisConnection();
  }

  return producerConnection;
}

function getAuditQueue() {
  if (!auditQueue) {
    auditQueue = new Queue(QUEUE_NAME, {
      connection: getProducerConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return auditQueue;
}

async function closeAuditQueue() {
  if (auditQueue) {
    await auditQueue.close();
    auditQueue = null;
  }

  if (producerConnection) {
    await producerConnection.quit();
    producerConnection = null;
  }
}

module.exports = {
  QUEUE_NAME,
  DEFAULT_JOB_OPTIONS,
  createRedisConnection,
  getAuditQueue,
  closeAuditQueue,
};
