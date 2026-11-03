const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { getAuditReportDownload } = require('../src/services/report-download');
const { createLocalReportStorage } = require('../src/services/report-storage');
const { generatePdfBuffer } = require('../src/services/pdf-report');

function fakePrisma(report) {
  return {
    audit: {
      async findUnique() {
        return report === undefined ? null : { report };
      },
    },
  };
}

test('download returns a PDF with safe attachment headers', async () => {
  const pdf = Buffer.from('%PDF-test');
  const result = await getAuditReportDownload(
    'audit_123',
    fakePrisma({ fileName: 'seo-audit-audit_123.pdf', filePath: 'audit_123.pdf' }),
    { async readReport(key) {
      assert.equal(key, 'audit_123.pdf');
      return pdf;
    } }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body, pdf);
  assert.equal(result.headers['Content-Type'], 'application/pdf');
  assert.equal(result.headers['Content-Disposition'], 'attachment; filename="seo-audit-audit_123.pdf"');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
});

test('download rejects invalid IDs without querying the database', async () => {
  let queried = false;
  const result = await getAuditReportDownload('../audit', {
    audit: { async findUnique() { queried = true; } },
  });
  assert.equal(result.status, 400);
  assert.equal(queried, false);
});

test('download reports missing audits, reports, and files', async () => {
  assert.equal((await getAuditReportDownload('audit_1', fakePrisma())).status, 404);
  assert.equal((await getAuditReportDownload('audit_1', fakePrisma(null))).status, 404);
  const missingFile = await getAuditReportDownload(
    'audit_1',
    fakePrisma({ fileName: 'report.pdf', filePath: 'audit_1.pdf' }),
    { async readReport() { const error = new Error('missing'); error.code = 'ENOENT'; throw error; } }
  );
  assert.equal(missingFile.status, 404);
  assert.equal(missingFile.body.error, 'Report file not found.');
});

test('download rejects a path traversal storage key', async () => {
  const result = await getAuditReportDownload(
    'audit_1',
    fakePrisma({ fileName: 'report.pdf', filePath: '../secret.pdf' })
  );
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Report file not found.');
});

test('generated PDF downloads through the same local storage adapter', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-report-download-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const storage = createLocalReportStorage(directory);
  const auditId = 'audit_shared_storage';
  const generatedPdf = await generatePdfBuffer({
    audit: {
      createdAt: new Date('2026-11-03T00:00:00.000Z'),
      website: {
        name: 'Storage integration test',
        url: 'https://example.test',
        client: { businessName: 'Demo client' },
      },
    },
    report: {
      overall_score: 80,
      score_breakdown: {
        technical: 80,
        on_page: 80,
        content: 80,
        core_web_vitals: 80,
        schema: 80,
      },
      executive_summary: 'Integration test PDF.',
      critical_issues: [],
      important_issues: [],
      quick_wins: [],
      recommendations: [],
    },
    signals: { website: { status: 'success' } },
    mockMode: true,
  });
  const storageKey = `${auditId}.pdf`;
  await storage.storeReport(storageKey, generatedPdf);

  const result = await getAuditReportDownload(
    auditId,
    fakePrisma({
      fileName: `seo-audit-${auditId}.pdf`,
      filePath: storageKey,
    }),
    storage
  );

  assert.equal(result.status, 200);
  assert.equal(result.headers['Content-Type'], 'application/pdf');
  assert.equal(result.body.subarray(0, 4).toString(), '%PDF');
});
