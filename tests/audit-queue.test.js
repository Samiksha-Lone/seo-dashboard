const test = require('node:test');
const assert = require('node:assert/strict');
const { enqueueAudit } = require('../src/services/audit-queue');

function makePrisma() {
  const audits = [];
  const lockTails = new Map();
  const website = {
    id: 'website_1',
    url: 'https://example.test/',
    clientId: 'client_1',
  };
  let auditId = 0;

  return {
    audits,
    async $transaction(callback) {
      const releases = [];
      const transaction = {
        async $queryRaw(strings, lockKey) {
          assert.match(strings.join('?'), /SELECT 1::integer AS locked/);
          assert.match(strings.join('?'), /pg_advisory_xact_lock/);
          const previous = lockTails.get(lockKey) || Promise.resolve();
          let release;
          const pending = new Promise((resolve) => { release = resolve; });
          const tail = previous.then(() => pending);
          lockTails.set(lockKey, tail);
          await previous;
          releases.push(() => {
            release();
            if (lockTails.get(lockKey) === tail) lockTails.delete(lockKey);
          });
        },
        client: {
          async findUnique() {
            return { id: website.clientId };
          },
        },
        website: {
          async findFirst() {
            return { id: website.id };
          },
          async create({ data }) {
            Object.assign(website, data);
            return { id: website.id };
          },
        },
        audit: {
          async findFirst({ where }) {
            if (where.createdAt) {
              return audits.find((audit) =>
                audit.websiteId === where.websiteId &&
                audit.createdAt >= where.createdAt.gte &&
                audit.createdAt < where.createdAt.lt
              ) || null;
            }

            return audits.find((audit) =>
              audit.websiteId === where.websiteId &&
              where.status.in.includes(audit.status)
            ) || null;
          },
          async create({ data }) {
            const audit = {
              id: `audit_${++auditId}`,
              status: data.status,
              websiteId: data.websiteId,
              createdAt: new Date(),
            };
            audits.push(audit);
            return { id: audit.id, status: audit.status };
          },
        },
      };

      try {
        return await callback(transaction);
      } finally {
        releases.forEach((release) => release());
      }
    },
    audit: {
      async updateMany() {
        return { count: 1 };
      },
    },
  };
}

test('concurrent monthly enqueue calls create and queue only one audit per website', async () => {
  const prisma = makePrisma();
  const queueCalls = [];
  const queue = {
    async add(name, data, options) {
      queueCalls.push({ name, data, options });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { id: options.jobId };
    },
  };
  const now = new Date();
  const monthlyWindow = {
    monthStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    nextMonthStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
  const input = {
    url: 'https://example.test/',
    clientId: 'client_1',
  };

  const results = await Promise.all([
    enqueueAudit(input, { prisma, queue, monthlyWindow }),
    enqueueAudit(input, { prisma, queue, monthlyWindow }),
  ]);

  assert.equal(prisma.audits.length, 1);
  assert.equal(queueCalls.length, 1);
  assert.equal(results.filter((result) => result.monthlyDuplicate).length, 1);
  assert.equal(results.filter((result) => result.jobId).length, 1);
});

test('monthly lock database errors include safe website and stage diagnostics', async () => {
  const prisma = makePrisma();
  prisma.$transaction = async (callback) => {
    const transaction = {
      client: { findUnique: async () => ({ id: 'client_1' }) },
      website: { findFirst: async () => ({ id: 'website_1' }) },
      async $queryRaw() {
        const error = new Error('Raw query failed for postgresql://user:password@db.example.test');
        error.name = 'PrismaClientKnownRequestError';
        error.code = 'P2010';
        throw error;
      },
    };
    return callback(transaction);
  };
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);

  try {
    await assert.rejects(
      enqueueAudit(
        { url: 'https://example.test/', clientId: 'client_1' },
        {
          prisma,
          queue: { add: async () => assert.fail('Queue must not be used after DB failure.') },
          websiteId: 'website_1',
          monthlyWindow: {
            monthStart: new Date('2026-11-01T00:00:00.000Z'),
            nextMonthStart: new Date('2026-12-01T00:00:00.000Z'),
          },
        }
      ),
      (error) => error.code === 'DATABASE_ERROR' && error.stage === 'database.monthly_lock'
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], 'Audit enqueue operation failed:');
  assert.deepEqual(logs[0][1], {
    websiteId: 'website_1',
    stage: 'database.monthly_lock',
    errorName: 'PrismaClientKnownRequestError',
    errorCode: 'P2010',
    prismaCode: 'P2010',
    safeMessage: 'Raw query failed for postgresql://[REDACTED]@db.example.test',
  });
});

test('Redis enqueue failures are diagnosed safely and mark the audit failed', async () => {
  const prisma = makePrisma();
  const updates = [];
  prisma.audit.updateMany = async (args) => {
    updates.push(args);
    return { count: 1 };
  };
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);

  try {
    await assert.rejects(
      enqueueAudit(
        { url: 'https://example.test/', clientId: 'client_1' },
        {
          prisma,
          websiteId: 'website_1',
          queue: {
            add: async () => {
              throw new Error('Redis unavailable at redis://user:password@redis.example.test');
            },
          },
        }
      ),
      (error) => error.code === 'QUEUE_ERROR' && error.statusCode === 503
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].where, { id: 'audit_1', status: 'QUEUED' });
  assert.equal(updates[0].data.status, 'FAILED');
  assert.match(updates[0].data.errorMessage, /redis:\/\/\[REDACTED\]@redis\.example\.test/);
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0][1], {
    websiteId: 'website_1',
    stage: 'queue.enqueue',
    errorName: 'Error',
    errorCode: null,
    prismaCode: null,
    safeMessage: 'Redis unavailable at redis://[REDACTED]@redis.example.test',
  });
});
