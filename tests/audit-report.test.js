const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateAndPersistAuditReport,
  sendReportNotificationOnce,
  sendReportNotifications,
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
    client: {
      businessName: 'Example Co',
      businessType: 'Services',
      city: 'Pune',
      state: 'MH',
      user: { email: 'client@example.test' },
    },
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
  const fields = [
    'whatsAppAttempts',
    'whatsAppClaimedAt',
    'whatsAppSentAt',
    'whatsAppCompletedAt',
    'whatsAppLastError',
    'emailAttempts',
    'emailClaimedAt',
    'emailSentAt',
    'emailCompletedAt',
    'emailLastError',
  ];
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
          ...(state.report || {
            id: 'report_123',
            auditId: 'audit_123',
            notificationAttemptedAt: null,
            ...Object.fromEntries(fields.map((field) => [
              field,
              field.endsWith('Attempts') ? 0 : null,
            ])),
          }),
          ...(state.report ? update : create),
        };
        return {
          id: state.report.id,
          fileName: state.report.fileName,
          generatedAt: state.report.generatedAt,
        };
      },
      async updateMany({ where, data }) {
        const report = state.report;
        if (!report || report.auditId !== where.auditId) return { count: 0 };
        const channelFields = fields.filter((field) =>
          Object.prototype.hasOwnProperty.call(where, field)
        );
        for (const field of channelFields) {
          const expected = where[field];
          if (expected === null && report[field] !== null) return { count: 0 };
          if (expected && typeof expected === 'object' && 'lt' in expected && !(report[field] < expected.lt)) {
            return { count: 0 };
          }
          if (expected && typeof expected === 'object' && 'not' in expected && report[field] === expected.not) {
            return { count: 0 };
          }
        }
        if (where.OR && !where.OR.some((condition) => {
          const [field, expected] = Object.entries(condition)[0];
          return expected === null
            ? report[field] === null
            : report[field] < expected.lt;
        })) return { count: 0 };

        for (const [field, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in value) {
            report[field] += value.increment;
          } else {
            report[field] = value;
          }
        }
        if (data.whatsAppAttempts) {
          state.notificationAttempts = report.whatsAppAttempts;
        }
        return { count: 1 };
      },
      async findUnique({ where, select }) {
        if (!state.report || state.report.auditId !== where.auditId) return null;
        return Object.fromEntries(Object.keys(select).map((field) => [field, state.report[field]]));
      },
    },
  };
  return { prisma, state };
}

test('PDF is stored and report metadata persisted before independent notifications', async () => {
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
    notifyEmail: async (notification) => {
      events.push('email');
      assert.equal(notification.clientEmail, 'client@example.test');
      assert.equal(notification.websiteName, 'Example');
      assert.equal(notification.auditScore, 81);
    },
  });

  assert.deepEqual(events, ['render', 'storage', 'metadata', 'notification', 'email']);
  assert.equal(state.upserts, 1);
  assert.equal(state.report.filePath, 'audit_123.pdf');
  assert.equal(state.notificationAttempts, 1);
  assert.equal(state.report.emailAttempts, 1);
  assert.equal(state.report.whatsAppSentAt instanceof Date, true);
  assert.equal(state.report.emailSentAt instanceof Date, true);
  assert.equal(result.report.fileName, 'seo-audit-audit_123.pdf');
  assert.equal(result.storage, 'local');
  assert.deepEqual(result.notifications, { whatsApp: 'mock_sent', email: 'mock_sent' });
});

test('Supabase report object path is persisted in the existing report filePath field', async () => {
  const { prisma, state } = createPrismaFake();
  let uploadedKey;
  const storage = {
    type: 'supabase',
    getReportKeyForAudit(auditId) {
      return `audits/${auditId}/report.pdf`;
    },
    async storeReport(key, content) {
      uploadedKey = key;
      assert.equal(content.toString(), '%PDF-test');
    },
  };

  const result = await generateAndPersistAuditReport(prisma, 'audit_123', {
    renderPdf: async () => Buffer.from('%PDF-test'),
    storage,
    notify: async () => {},
    notifyEmail: async () => {},
  });

  assert.equal(uploadedKey, 'audits/audit_123/report.pdf');
  assert.equal(state.report.filePath, 'audits/audit_123/report.pdf');
  assert.equal(result.storage, 'supabase');
});

test('report retry reuses one report row and does not duplicate notification', async () => {
  const { prisma, state } = createPrismaFake();
  let notifications = 0;
  const dependencies = {
    renderPdf: async () => Buffer.from('%PDF-test'),
    storage: { type: 'local', async storeReport() {} },
    notify: async () => { notifications += 1; },
    notifyEmail: async () => {},
  };

  await generateAndPersistAuditReport(prisma, 'audit_123', dependencies);
  await generateAndPersistAuditReport(prisma, 'audit_123', dependencies);

  assert.equal(state.upserts, 2);
  assert.equal(state.notificationAttempts, 1);
  assert.equal(notifications, 1);
});

test('concurrent report retries claim a notification only once', async () => {
  const { prisma, state } = createPrismaFake();
  await prisma.report.upsert({
    create: { auditId: 'audit_123' },
    update: {},
  });
  let calls = 0;
  const send = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
  };
  const [first, second] = await Promise.all([
    sendReportNotificationOnce(prisma, 'audit_123', {}, send),
    sendReportNotificationOnce(prisma, 'audit_123', {}, send),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(new Set([first.status, second.status]), new Set(['mock_sent', 'already_sent']));
  assert.equal(state.report.whatsAppAttempts, 1);
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

  const first = await sendReportNotificationOnce(prisma, 'audit_123', {}, send, {
    sleep: async () => {},
  });
  const retry = await sendReportNotificationOnce(prisma, 'audit_123', {}, send, {
    sleep: async () => {},
  });

  assert.equal(first.status, 'failed');
  assert.equal(retry.status, 'already_attempted');
  assert.equal(calls, 3);
  assert.equal(state.notificationAttempts, 3);
});

test('failed notification retries are bounded and successful retries are not duplicated', async () => {
  const { prisma, state } = createPrismaFake();
  await prisma.report.upsert({
    create: { auditId: 'audit_123' },
    update: {},
  });
  let calls = 0;
  const first = await sendReportNotificationOnce(prisma, 'audit_123', {}, async () => {
    calls += 1;
    if (calls < 3) throw new Error('temporary delivery failure');
  }, { sleep: async () => {} });
  const second = await sendReportNotificationOnce(prisma, 'audit_123', {}, async () => {
    calls += 1;
  }, { sleep: async () => {} });

  assert.equal(first.status, 'mock_sent');
  assert.equal(second.status, 'already_sent');
  assert.equal(calls, 3);
  assert.equal(state.report.whatsAppAttempts, 3);
});

test('expired notification claim is recovered after a worker crash', async () => {
  const { prisma, state } = createPrismaFake();
  await prisma.report.upsert({
    create: { auditId: 'audit_123' },
    update: {},
  });
  state.report.whatsAppAttempts = 1;
  state.report.whatsAppClaimedAt = new Date('2026-11-03T00:00:00.000Z');
  const sent = [];
  const result = await sendReportNotificationOnce(prisma, 'audit_123', {}, async () => {
    sent.push(true);
  }, {
    now: () => new Date('2026-11-03T00:01:00.000Z'),
    sleep: async () => {},
  });
  assert.equal(result.status, 'mock_sent');
  assert.equal(sent.length, 1);
  assert.equal(state.report.whatsAppAttempts, 2);
});

test('email mock reports missing addresses without attempting delivery', async () => {
  const { sendEmail } = require('../src/mocks/email.mock');
  const result = await sendEmail({
    clientEmail: ' ',
    clientName: 'Example',
    websiteName: 'Example site',
    auditScore: 90,
    reportReference: 'report.pdf',
  });
  assert.deepEqual(result, { channel: 'email', status: 'skipped_missing_email' });
});

test('email mock logs a simulated delivery and returns a structured result', async () => {
  const { sendEmail } = require('../src/mocks/email.mock');
  const originalInfo = console.info;
  const logs = [];
  console.info = (...args) => logs.push(args);
  try {
    const result = await sendEmail({
      clientEmail: 'client@example.test',
      clientName: 'Example Client',
      websiteName: 'Example Website',
      auditScore: 92,
      reportReference: 'SEO-Audit-Example-Website-2026-11-03.pdf',
    });
    assert.deepEqual(result, { channel: 'email', status: 'mock_sent' });
  } finally {
    console.info = originalInfo;
  }
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], '[MOCK EMAIL] Simulated report email delivery.');
  assert.deepEqual(logs[0][1], {
    to: 'client@example.test',
    clientName: 'Example Client',
    websiteName: 'Example Website',
    auditScore: '92/100',
    reportReference: 'SEO-Audit-Example-Website-2026-11-03.pdf',
  });
});

test('notification channels track outcomes independently', async () => {
  const { prisma, state } = createPrismaFake();
  await prisma.report.upsert({
    create: { auditId: 'audit_123' },
    update: {},
  });
  const result = await sendReportNotifications(prisma, 'audit_123', {}, {
    notifyWhatsApp: async () => { throw new Error('WhatsApp unavailable'); },
    notifyEmail: async () => ({ status: 'skipped_missing_email' }),
    sleep: async () => {},
  });
  assert.deepEqual(result, { whatsApp: 'failed', email: 'skipped_missing_email' });
  assert.equal(state.report.whatsAppAttempts, 3);
  assert.equal(state.report.whatsAppSentAt, null);
  assert.equal(state.report.emailAttempts, 1);
  assert.equal(state.report.emailLastError, 'missing_email');
});
