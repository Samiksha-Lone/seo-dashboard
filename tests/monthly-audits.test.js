const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getUtcMonthRange,
  handleMonthlyAuditRequest,
} = require('../src/services/monthly-audits');

const now = new Date('2026-11-03T10:00:00.000Z');

function makeWebsite(id, overrides = {}) {
  return {
    id,
    url: `https://${id}.example.test/`,
    client: { id: `client_${id}` },
    audits: [],
    ...overrides,
  };
}

function makePrisma(websites) {
  const calls = [];
  return {
    calls,
    website: {
      async findMany(query) {
        calls.push(query);
        if (websites instanceof Error) throw websites;
        return websites;
      },
    },
  };
}

function request(prisma, overrides = {}) {
  return handleMonthlyAuditRequest({
    authorization: 'Bearer test-cron-secret',
    secret: 'test-cron-secret',
    prisma,
    now,
    ...overrides,
  });
}

test('UTC month range uses inclusive start and exclusive next-month boundary', () => {
  const range = getUtcMonthRange(new Date('2026-12-31T23:59:59.999Z'));
  assert.equal(range.monthStart.toISOString(), '2026-12-01T00:00:00.000Z');
  assert.equal(range.nextMonthStart.toISOString(), '2027-01-01T00:00:00.000Z');
});

test('missing and invalid authorization are rejected without exposing the secret', async () => {
  const prisma = makePrisma([]);
  const missing = await handleMonthlyAuditRequest({
    authorization: null,
    secret: 'test-cron-secret',
    prisma,
  });
  const invalid = await handleMonthlyAuditRequest({
    authorization: 'Bearer wrong-value',
    secret: 'test-cron-secret',
    prisma,
  });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.deepEqual(missing.body, { success: false, error: 'Unauthorized.' });
  assert.equal(JSON.stringify(invalid.body).includes('test-cron-secret'), false);
  assert.equal(prisma.calls.length, 0);
});

test('missing CRON_SECRET returns a safe server error', async () => {
  const result = await handleMonthlyAuditRequest({
    authorization: 'Bearer anything',
    secret: null,
    prisma: makePrisma([]),
  });
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    success: false,
    error: 'Monthly audit scheduling is not configured.',
  });
});

test('no registered websites returns an empty scheduling summary', async () => {
  const result = await request(makePrisma([]), { enqueueAudit: async () => assert.fail() });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, {
    totalWebsites: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
  });
});

test('eligible websites are queued independently through the existing enqueue service', async () => {
  const websites = [makeWebsite('one'), makeWebsite('two')];
  const prisma = makePrisma(websites);
  const queued = [];
  const result = await request(prisma, {
    enqueueAudit: async (input) => queued.push(input),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, {
    totalWebsites: 2,
    queued: 2,
    skipped: 0,
    failed: 0,
  });
  assert.deepEqual(queued, websites.map((website) => ({
    url: website.url,
    clientId: website.client.id,
  })));
  const where = prisma.calls[0].select.audits.where;
  assert.deepEqual(where, {
    createdAt: {
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lt: new Date('2026-12-01T00:00:00.000Z'),
    },
  });
});

test('existing audits of every lifecycle status are skipped', async () => {
  const statuses = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'];
  const websites = statuses.map((status, index) =>
    makeWebsite(`existing_${index}`, { audits: [{ id: `audit_${index}`, status }] })
  );
  const result = await request(makePrisma(websites), {
    enqueueAudit: async () => assert.fail('Existing monthly audit must not be enqueued again.'),
  });

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, {
    totalWebsites: 4,
    queued: 0,
    skipped: 4,
    failed: 0,
  });
});

test('websites with no valid associated client are skipped', async () => {
  const prisma = makePrisma([
    makeWebsite('missing-client', { client: null }),
    makeWebsite('blank-client', { client: { id: ' ' } }),
    makeWebsite('eligible'),
  ]);
  let queued = 0;
  const result = await request(prisma, {
    enqueueAudit: async () => { queued += 1; },
  });

  assert.equal(queued, 1);
  assert.deepEqual(result.body.summary, {
    totalWebsites: 3,
    queued: 1,
    skipped: 2,
    failed: 0,
  });
});

test('one enqueue failure does not stop scheduling other websites', async () => {
  const websites = [makeWebsite('first'), makeWebsite('bad'), makeWebsite('last')];
  const processed = [];
  const result = await request(makePrisma(websites), {
    enqueueAudit: async ({ url }) => {
      processed.push(url);
      if (url.includes('bad.')) {
        const error = new Error('Redis URL secret and stack are private.');
        error.code = 'QUEUE_ERROR';
        throw error;
      }
    },
  });

  assert.deepEqual(processed, websites.map((website) => website.url));
  assert.deepEqual(result.body.summary, {
    totalWebsites: 3,
    queued: 2,
    skipped: 0,
    failed: 1,
  });
  assert.deepEqual(result.body.failures, [{
    websiteId: 'bad',
    reason: 'Audit queue is temporarily unavailable.',
  }]);
  assert.equal(JSON.stringify(result.body).includes('Redis URL'), false);
});

test('repeated cron requests skip audits created by the first request', async () => {
  const website = makeWebsite('same');
  const prisma = makePrisma([website]);
  let enqueueCalls = 0;
  const enqueueAudit = async () => {
    enqueueCalls += 1;
    website.audits.push({ id: 'created_this_month', status: 'QUEUED' });
  };

  const first = await request(prisma, { enqueueAudit });
  const retry = await request(prisma, { enqueueAudit });

  assert.equal(first.body.summary.queued, 1);
  assert.equal(retry.body.summary.skipped, 1);
  assert.equal(enqueueCalls, 1);
});

test('database lookup failures return a safe server error', async () => {
  const result = await request(makePrisma(new Error('database connection includes secrets')));
  assert.equal(result.status, 500);
  assert.deepEqual(result.body, {
    success: false,
    error: 'Unable to schedule monthly audits.',
  });
  assert.equal(JSON.stringify(result.body).includes('secrets'), false);
});
