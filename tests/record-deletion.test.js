const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RecordDeletionError,
  deleteAudit,
  deleteClient,
  deleteWebsite,
} = require('../src/services/record-deletion');

function createPrismaFixture({ auditStatuses = ['COMPLETED', 'FAILED'], failRecommendationDelete = false } = {}) {
  const initialState = {
    clients: [{ id: 'client_1' }],
    websites: [{ id: 'website_1', clientId: 'client_1' }],
    audits: auditStatuses.map((status, index) => ({
      id: `audit_${index + 1}`,
      websiteId: 'website_1',
      status,
    })),
    issues: auditStatuses.map((_, index) => ({ id: `issue_${index + 1}`, auditId: `audit_${index + 1}` })),
    recommendations: auditStatuses.map((_, index) => ({ id: `recommendation_${index + 1}`, auditId: `audit_${index + 1}` })),
    reports: auditStatuses.map((_, index) => ({
      id: `report_${index + 1}`,
      auditId: `audit_${index + 1}`,
      filePath: `audits/audit_${index + 1}/report.pdf`,
    })),
  };
  let state = initialState;
  const calls = [];

  function getAuditWithReport(id) {
    const audit = state.audits.find((entry) => entry.id === id);
    if (!audit) return null;
    const report = state.reports.find((entry) => entry.auditId === id);
    return { ...audit, report: report ? { filePath: report.filePath } : null };
  }

  function getWebsite(id) {
    const website = state.websites.find((entry) => entry.id === id);
    if (!website) return null;
    return {
      ...website,
      audits: state.audits
        .filter((audit) => audit.websiteId === id)
        .map((audit) => getAuditWithReport(audit.id)),
    };
  }

  function getClient(id) {
    const client = state.clients.find((entry) => entry.id === id);
    if (!client) return null;
    return {
      ...client,
      websites: state.websites
        .filter((website) => website.clientId === id)
        .map((website) => getWebsite(website.id)),
    };
  }

  const transaction = {
    async $queryRaw() {},
    client: {
      async findUnique({ where }) { return getClient(where.id); },
      async delete({ where }) {
        calls.push(`client.delete:${where.id}`);
        state.clients = state.clients.filter((entry) => entry.id !== where.id);
      },
    },
    website: {
      async findUnique({ where }) { return getWebsite(where.id); },
      async delete({ where }) {
        calls.push(`website.delete:${where.id}`);
        state.websites = state.websites.filter((entry) => entry.id !== where.id);
      },
    },
    audit: {
      async findUnique({ where }) { return getAuditWithReport(where.id); },
      async deleteMany({ where }) {
        calls.push(`audit.delete:${where.id}`);
        const current = state.audits.find((entry) => entry.id === where.id);
        if (!current || where.status.notIn.includes(current.status)) return { count: 0 };
        state.audits = state.audits.filter((entry) => entry.id !== where.id);
        return { count: 1 };
      },
    },
    auditIssue: {
      async deleteMany({ where }) {
        calls.push(`issues.delete:${where.auditId}`);
        state.issues = state.issues.filter((entry) => entry.auditId !== where.auditId);
      },
    },
    auditRecommendation: {
      async deleteMany({ where }) {
        calls.push(`recommendations.delete:${where.auditId}`);
        if (failRecommendationDelete) throw new Error('transaction failed');
        state.recommendations = state.recommendations.filter((entry) => entry.auditId !== where.auditId);
      },
    },
    report: {
      async deleteMany({ where }) {
        calls.push(`report-metadata.delete:${where.auditId}`);
        state.reports = state.reports.filter((entry) => entry.auditId !== where.auditId);
      },
    },
  };

  return {
    calls,
    get state() { return state; },
    async $transaction(callback, options) {
      assert.deepEqual(options, { isolationLevel: 'Serializable' });
      const previousState = state;
      state = structuredClone(previousState);
      try {
        const result = await callback(transaction);
        return result;
      } catch (error) {
        state = previousState;
        throw error;
      }
    },
  };
}

test('client deletion transaction removes audits, findings, recommendations, report metadata, websites, then client', async () => {
  const prisma = createPrismaFixture();
  const removedFiles = [];
  const result = await deleteClient(prisma, 'client_1', {
    storage: { async deleteReport(key) { removedFiles.push(key); } },
  });

  assert.deepEqual(prisma.calls, [
    'issues.delete:audit_1',
    'recommendations.delete:audit_1',
    'report-metadata.delete:audit_1',
    'audit.delete:audit_1',
    'issues.delete:audit_2',
    'recommendations.delete:audit_2',
    'report-metadata.delete:audit_2',
    'audit.delete:audit_2',
    'website.delete:website_1',
    'client.delete:client_1',
  ]);
  assert.deepEqual(removedFiles, [
    'audits/audit_1/report.pdf',
    'audits/audit_2/report.pdf',
  ]);
  assert.deepEqual(result, { id: 'client_1', storageCleanupFailures: 0 });
  assert.deepEqual(prisma.state, {
    clients: [],
    websites: [],
    audits: [],
    issues: [],
    recommendations: [],
    reports: [],
  });
});

test('website and individual audit deletion cascade report metadata and child records', async () => {
  const websitePrisma = createPrismaFixture({ auditStatuses: ['COMPLETED'] });
  const websiteResult = await deleteWebsite(websitePrisma, 'website_1', {
    storage: { async deleteReport() {} },
  });
  assert.equal(websiteResult.storageCleanupFailures, 0);
  assert.deepEqual(websitePrisma.state.websites, []);
  assert.deepEqual(websitePrisma.state.audits, []);
  assert.deepEqual(websitePrisma.state.issues, []);
  assert.deepEqual(websitePrisma.state.recommendations, []);
  assert.deepEqual(websitePrisma.state.reports, []);

  const auditPrisma = createPrismaFixture({ auditStatuses: ['FAILED'] });
  const auditResult = await deleteAudit(auditPrisma, 'audit_1', {
    storage: { async deleteReport() {} },
  });
  assert.equal(auditResult.id, 'audit_1');
  assert.deepEqual(auditPrisma.state.audits, []);
  assert.deepEqual(auditPrisma.state.issues, []);
  assert.deepEqual(auditPrisma.state.recommendations, []);
  assert.deepEqual(auditPrisma.state.reports, []);
  assert.equal(auditPrisma.state.websites.length, 1);
});

test('active audits prevent parent or individual deletion without changing database or storage', async () => {
  for (const remove of [
    (prisma, storage) => deleteAudit(prisma, 'audit_1', { storage }),
    (prisma, storage) => deleteWebsite(prisma, 'website_1', { storage }),
    (prisma, storage) => deleteClient(prisma, 'client_1', { storage }),
  ]) {
    const prisma = createPrismaFixture({ auditStatuses: ['PROCESSING'] });
    let cleanupCalls = 0;
    await assert.rejects(
      remove(prisma, { async deleteReport() { cleanupCalls += 1; } }),
      (error) => error instanceof RecordDeletionError && error.statusCode === 409,
    );
    assert.equal(prisma.state.audits.length, 1);
    assert.equal(prisma.state.websites.length, 1);
    assert.equal(prisma.state.clients.length, 1);
    assert.equal(cleanupCalls, 0);
  }
});

test('transaction failure rolls back every database deletion and skips object cleanup', async () => {
  const prisma = createPrismaFixture({ auditStatuses: ['COMPLETED'], failRecommendationDelete: true });
  let cleanupCalls = 0;

  await assert.rejects(
    deleteClient(prisma, 'client_1', {
      storage: { async deleteReport() { cleanupCalls += 1; } },
    }),
    /transaction failed/,
  );
  assert.equal(prisma.state.clients.length, 1);
  assert.equal(prisma.state.websites.length, 1);
  assert.equal(prisma.state.audits.length, 1);
  assert.equal(prisma.state.issues.length, 1);
  assert.equal(prisma.state.recommendations.length, 1);
  assert.equal(prisma.state.reports.length, 1);
  assert.equal(cleanupCalls, 0);
});

test('storage cleanup failure is reported but does not undo committed database deletion', async () => {
  const prisma = createPrismaFixture({ auditStatuses: ['COMPLETED'] });
  const result = await deleteAudit(prisma, 'audit_1', {
    storage: {
      async deleteReport() {
        throw Object.assign(new Error('storage unavailable'), { code: 'SUPABASE_STORAGE_ERROR' });
      },
    },
  });

  assert.equal(result.storageCleanupFailures, 1);
  assert.deepEqual(prisma.state.audits, []);
  assert.deepEqual(prisma.state.issues, []);
  assert.deepEqual(prisma.state.recommendations, []);
  assert.deepEqual(prisma.state.reports, []);
});

test('missing records return 404 without attempting storage cleanup', async () => {
  const prisma = createPrismaFixture();
  let cleanupCalls = 0;
  await assert.rejects(
    deleteWebsite(prisma, 'missing', {
      storage: { async deleteReport() { cleanupCalls += 1; } },
    }),
    (error) => error instanceof RecordDeletionError && error.statusCode === 404,
  );
  assert.equal(cleanupCalls, 0);
});
