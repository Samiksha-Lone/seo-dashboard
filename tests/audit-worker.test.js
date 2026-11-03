const test = require('node:test');
const assert = require('node:assert/strict');
const { processAuditJob } = require('../src/workers/seo-audit.worker');

function createWorkerDependencies({ reportFails = false } = {}) {
  const state = {
    status: 'QUEUED',
    errorMessage: null,
    events: [],
  };
  const prisma = {
    async $transaction(callback) {
      return callback({
        audit: {
          async findUnique() {
            return { status: state.status, website: { clientId: 'client_1' } };
          },
          async update({ data }) {
            state.status = data.status;
            state.errorMessage = data.errorMessage;
            state.events.push(`status:${data.status}`);
          },
        },
        auditIssue: { async deleteMany() {} },
        auditRecommendation: { async deleteMany() {} },
      });
    },
    audit: {
      async update({ data }) {
        state.status = data.status;
        state.errorMessage = data.errorMessage;
        state.events.push(`status:${data.status}`);
      },
      async updateMany({ data }) {
        state.status = data.status;
        state.errorMessage = data.errorMessage;
        state.events.push(`status:${data.status}`);
      },
    },
  };

  return {
    state,
    dependencies: {
      getPrismaClient: async () => prisma,
      runAudit: async () => {
        assert.equal(state.status, 'PROCESSING');
        state.events.push('audit');
        return { status: 'processing' };
      },
      generateAndPersistAuditReport: async () => {
        assert.equal(state.status, 'PROCESSING');
        state.events.push('report');
        if (reportFails) throw new Error('PDF generation failed');
        return { report: { fileName: 'seo-audit-audit_1.pdf' } };
      },
    },
  };
}

const job = {
  id: 'job_1',
  data: { auditId: 'audit_1', url: 'https://example.test', clientId: 'client_1' },
  attemptsMade: 0,
};

test('worker marks an audit complete only after audit data and PDF report succeed', async () => {
  const { state, dependencies } = createWorkerDependencies();
  const result = await processAuditJob(job, dependencies);
  assert.deepEqual(state.events, ['status:PROCESSING', 'audit', 'report', 'status:COMPLETED']);
  assert.equal(result.status, 'COMPLETED');
});

test('worker marks PDF generation failures as failed and rethrows for queue retries', async () => {
  const { state, dependencies } = createWorkerDependencies({ reportFails: true });
  await assert.rejects(processAuditJob(job, dependencies), /PDF generation failed/);
  assert.deepEqual(state.events, ['status:PROCESSING', 'audit', 'report', 'status:FAILED']);
  assert.equal(state.status, 'FAILED');
  assert.equal(state.errorMessage, 'PDF generation failed');
});
