const test = require('node:test');
const assert = require('node:assert/strict');
const { persistAudit } = require('../src/services/audit');

const report = {
  audit_version: 'v1.0',
  overall_score: 82,
  score_breakdown: {
    technical: 80,
    on_page: 84,
    content: 75,
    core_web_vitals: 90,
    schema: 81,
  },
  critical_issues: [{
    category: 'technical',
    title: 'Critical issue',
    finding: 'A saved finding',
    fix: 'Apply the fix',
    estimated_impact: 'High',
    effort: 'Days',
    falsifiability_check: 'Re-run the check',
  }],
  important_issues: [],
  quick_wins: [],
  recommendations: [{
    priority: 'CRITICAL',
    category: 'technical',
    finding: 'A recommendation',
    fix: 'Apply recommendation',
    estimated_impact: 'High',
    effort: 'Days',
    falsifiability_check: 'Verify the outcome',
  }],
  executive_summary: 'A valid audit summary.',
};

function createPrismaFake() {
  const state = {
    transactionOptions: null,
    calls: [],
    updatedAudit: null,
  };
  const transaction = {
    audit: {
      async findUnique(args) {
        state.calls.push(['audit.findUnique', args]);
        return {
          id: 'audit_existing',
          status: 'PROCESSING',
          website: { id: 'website_1', clientId: 'client_1' },
        };
      },
      async update(args) {
        state.calls.push(['audit.update', args]);
        state.updatedAudit = args;
        return { id: args.where.id, ...args.data };
      },
      async create(args) {
        state.calls.push(['audit.create', args]);
        return { id: 'audit_new', ...args.data };
      },
    },
    auditIssue: {
      async deleteMany(args) {
        state.calls.push(['auditIssue.deleteMany', args]);
        return { count: 1 };
      },
    },
    auditRecommendation: {
      async deleteMany(args) {
        state.calls.push(['auditRecommendation.deleteMany', args]);
        return { count: 1 };
      },
    },
    website: {
      async findFirst(args) {
        state.calls.push(['website.findFirst', args]);
        return { id: 'website_1' };
      },
      async create(args) {
        state.calls.push(['website.create', args]);
        return { id: 'website_1' };
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(callback, options) {
        state.transactionOptions = options;
        state.calls.push(['transaction.begin']);
        const result = await callback(transaction);
        state.calls.push(['transaction.commit']);
        return result;
      },
    },
  };
}

test('existing audit persistence is atomic with a 20-second transaction timeout', async () => {
  const { prisma, state } = createPrismaFake();
  const saved = await persistAudit({
    prisma,
    clientId: 'client_1',
    auditId: 'audit_existing',
    auditUrl: 'https://example.test/',
    websiteName: 'example.test',
    startedAt: new Date('2026-11-03T00:00:00Z'),
    signals: { website: { status: 'success', data: {} } },
    report,
  });

  assert.deepEqual(state.transactionOptions, { timeout: 20_000 });
  assert.deepEqual(state.calls.map(([name]) => name), [
    'transaction.begin',
    'audit.findUnique',
    'auditIssue.deleteMany',
    'auditRecommendation.deleteMany',
    'audit.update',
    'transaction.commit',
  ]);
  assert.equal(state.updatedAudit.where.id, 'audit_existing');
  assert.equal(state.updatedAudit.data.status, 'PROCESSING');
  assert.equal(state.updatedAudit.data.completedAt, null);
  assert.equal(state.updatedAudit.data.websiteId, 'website_1');
  assert.equal(state.updatedAudit.data.issues.create[0].severity, 'CRITICAL');
  assert.equal(state.updatedAudit.data.recommendations.create[0].priority, 'CRITICAL');
  assert.equal(saved.id, 'audit_existing');
});

test('new audit persistence retains website lookup and creation in the same transaction', async () => {
  const { prisma, state } = createPrismaFake();
  const saved = await persistAudit({
    prisma,
    clientId: 'client_1',
    auditUrl: 'https://example.test/',
    websiteName: 'example.test',
    startedAt: new Date('2026-11-03T00:00:00Z'),
    signals: {},
    report,
  });

  assert.deepEqual(state.transactionOptions, { timeout: 20_000 });
  assert.ok(state.calls.some(([name]) => name === 'website.findFirst'));
  assert.deepEqual(state.calls.map(([name]) => name), [
    'transaction.begin',
    'website.findFirst',
    'audit.create',
    'transaction.commit',
  ]);
  assert.equal(saved.id, 'audit_new');
});
