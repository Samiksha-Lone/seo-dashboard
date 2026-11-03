const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateAndPersistAuditReport,
  sendReportNotificationOnce,
} = require('../src/services/audit-report');

const auditFixture = {
  id: 'audit_123',
  status: 'PROCESSING',
  overallScore: 81,
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
  startedAt: new Date('2026-11-03T00:01:00.000Z'),
  website: {
    name: 'Example',
    url: 'https://example.test',
    client: { businessName: 'Example Co', businessType: 'Services', city: 'Pune', state: 'MH' },
  },
  signals: { crawl: { status: 'success' } },
  result: {
    audit_version: 'v1.0',
    overall_score: 81,
    score_breakdown: {
      technical: 80,
      on_page: 82,
      content: 75,
      core_web_vitals: 90,
      schema: 78,
    },
    critical_issues: [],
    important_issues: [],
    quick_wins: [],
    recommendations: [],
    executive_summary: 'A valid report summary.',
  },
};

function createPrismaFake() {
  const state = { report: null, upserts: 0, notificationAttempts: 0, events: [] };
  const prisma = {
    audit: {
      async findUnique() {
        return auditFixture;
      },
    },
    report: {
      async upsert({ create, update }) {
        state.events.push('metadata');
        state.upserts += 1;
        state.report = {
          id: 'report_123',
          ...(state.report ? update : create),
        };
        return {
          id: state.report.id,
          fileName: state.report.fileName,
          generatedAt: state.report.generatedAt,
        };
      },
      async updateMany({ where, data }) {
        if (state.report && state.report.auditId === where.auditId &&
            state.report.notificationAttemptedAt == null) {
          state.report.notificationAttemptedAt = data.notificationAttemptedAt;
          state.notificationAttempts += 1;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };
  return { prisma, state };
}

test('PDF is stored and report metadata persisted before notification', async () => {
  const { prisma, state } = createPrismaFake();
  const events = state.events;
  const result = await generateAndPersistAuditReport(prisma, 'audit_123', {
    renderPdf: async () => {
      events.push('render');
      return Buffer.from('%PDF-test');
    },
    storage: {
      type: 'local',
      async storeReport(key, content) {
        assert.equal(key, 'audit_123.pdf');
        assert.equal(content.toString(), '%PDF-test');
        events.push('storage');
      },
    },
    notify: async (notification) => {
      events.push('notification');
      assert.equal(notification.auditId, 'audit_123');
      assert.equal(notification.clientName, 'Example Co');
      assert.equal(notification.score, 81);
    },
  });

  assert.deepEqual(events, ['render', 'storage', 'metadata', 'notification']);
  assert.equal(state.upserts, 1);
  assert.equal(state.report.filePath, 'audit_123.pdf');
  assert.equal(state.notificationAttempts, 1);
  assert.equal(result.report.fileName, 'seo-audit-audit_123.pdf');
  assert.equal(result.storage, 'local');
});

test('report retry reuses one report row and does not duplicate notification', async () => {
  const { prisma, state } = createPrismaFake();
  let notifications = 0;
  const dependencies = {
    renderPdf: async () => Buffer.from('%PDF-test'),
    storage: { type: 'local', async storeReport() {} },
    notify: async () => { notifications += 1; },
  };

  await generateAndPersistAuditReport(prisma, 'audit_123', dependencies);
  await generateAndPersistAuditReport(prisma, 'audit_123', dependencies);

  assert.equal(state.upserts, 2);
  assert.equal(state.notificationAttempts, 1);
  assert.equal(notifications, 1);
});

test('notification is not called when PDF storage fails', async () => {
  const { prisma, state } = createPrismaFake();
  let notifications = 0;
  await assert.rejects(
    generateAndPersistAuditReport(prisma, 'audit_123', {
      renderPdf: async () => Buffer.from('%PDF-test'),
      storage: {
        type: 'local',
        async storeReport() { throw new Error('disk unavailable'); },
      },
      notify: async () => { notifications += 1; },
    }),
    /disk unavailable/
  );
  assert.equal(state.upserts, 0);
  assert.equal(notifications, 0);
});

test('notification failure is non-fatal and claimed once', async () => {
  const { prisma, state } = createPrismaFake();
  await prisma.report.upsert({
    create: { auditId: 'audit_123' },
    update: {},
  });
  let calls = 0;
  const send = async () => {
    calls += 1;
    throw new Error('mock service unavailable');
  };

  const first = await sendReportNotificationOnce(prisma, 'audit_123', {}, send);
  const retry = await sendReportNotificationOnce(prisma, 'audit_123', {}, send);

  assert.equal(first.status, 'failed');
  assert.equal(retry.status, 'already_attempted');
  assert.equal(calls, 1);
  assert.equal(state.notificationAttempts, 1);
});
