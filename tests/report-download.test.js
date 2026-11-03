const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDownloadFileName, getAuditReportDownload } = require('../src/services/report-download');
const {
  createLocalReportStorage,
  createSupabaseReportStorage,
  REPORT_MAX_FILE_SIZE_BYTES,
} = require('../src/services/report-storage');
const { generatePdfBuffer } = require('../src/services/pdf-report');

function fakePrisma(report) {
  return {
    audit: {
      async findFirst() {
        return report === undefined
          ? null
          : {
            createdAt: new Date('2026-11-03T08:30:00.000Z'),
            website: { name: 'Example Website' },
            report,
          };
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
  assert.equal(result.headers['Content-Disposition'], 'attachment; filename="SEO-Audit-Example-Website-2026-11-03.pdf"');
  assert.equal(result.headers['X-Content-Type-Options'], 'nosniff');
});

test('Supabase download redirects to a signed URL with the readable filename', async () => {
  const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/seo-reports/token';
  let signedUrlArguments;
  const result = await getAuditReportDownload(
    'audit_123',
    fakePrisma({ fileName: 'seo-audit-audit_123.pdf', filePath: 'audits/audit_123/report.pdf' }),
    {
      async createSignedDownloadUrl(...args) {
        signedUrlArguments = args;
        return signedUrl;
      },
    },
    { user: { role: 'ADMIN' } }
  );

  assert.equal(result.status, 302);
  assert.equal(result.body, null);
  assert.equal(result.headers.Location, signedUrl);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(signedUrlArguments, [
    'audits/audit_123/report.pdf',
    'SEO-Audit-Example-Website-2026-11-03.pdf',
  ]);
});

test('download filename sanitizes website names and uses a safe fallback', () => {
  assert.equal(
    createDownloadFileName('Samiksha Portfolio', new Date('2026-11-03T00:00:00.000Z')),
    'SEO-Audit-Samiksha-Portfolio-2026-11-03.pdf'
  );
  assert.equal(
    createDownloadFileName('Example / Website: SEO!!!', new Date('2026-11-03T23:59:00.000Z')),
    'SEO-Audit-Example-Website-SEO-2026-11-03.pdf'
  );
  assert.equal(
    createDownloadFileName(undefined, new Date('2026-11-03T00:00:00.000Z')),
    'SEO-Audit-Report-2026-11-03.pdf'
  );
  assert.equal(
    createDownloadFileName('A'.repeat(100), new Date('invalid')),
    `SEO-Audit-${'A'.repeat(60)}-unknown-date.pdf`
  );
});

test('download rejects invalid IDs without querying the database', async () => {
  let queried = false;
  const result = await getAuditReportDownload('../audit', {
    audit: { async findFirst() { queried = true; } },
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

test('download reports a missing Supabase object as not found', async () => {
  const storage = createSupabaseReportStorage({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: 'sb_secret_test-only-not-real',
    createClient: () => ({
      storage: {
        async getBucket() {
          return {
            data: {
              public: false,
              allowed_mime_types: ['application/pdf'],
              file_size_limit: REPORT_MAX_FILE_SIZE_BYTES,
            },
            error: null,
          };
        },
        from() {
          return {
            async createSignedUrl() {
              return { data: null, error: { message: 'Object not found', statusCode: '404' } };
            },
          };
        },
      },
    }),
  });

  const result = await getAuditReportDownload(
    'audit_123',
    fakePrisma({ fileName: 'report.pdf', filePath: 'audits/audit_123/report.pdf' }),
    storage
  );

  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Report file not found.');
});

test('download rejects a path traversal storage key', async () => {
  const result = await getAuditReportDownload(
    'audit_1',
    fakePrisma({ fileName: 'report.pdf', filePath: '../secret.pdf' })
  );
  assert.equal(result.status, 404);
  assert.equal(result.body.error, 'Report file not found.');
});

test('client ownership is checked before a signed URL can be generated', async () => {
  let query;
  let signedUrlRequested = false;
  const result = await getAuditReportDownload(
    'audit_123',
    {
      audit: {
        async findFirst(args) {
          query = args;
          return null;
        },
      },
    },
    {
      async createSignedDownloadUrl() {
        signedUrlRequested = true;
        return 'https://must-not-be-issued.test/';
      },
    },
    { user: { role: 'CLIENT', clientId: 'different_client' } }
  );

  assert.equal(result.status, 404);
  assert.deepEqual(query.where, {
    id: 'audit_123',
    website: { clientId: 'different_client' },
  });
  assert.equal(signedUrlRequested, false);
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
  assert.equal(result.headers['Content-Disposition'], 'attachment; filename="SEO-Audit-Example-Website-2026-11-03.pdf"');
  assert.equal(result.body.subarray(0, 4).toString(), '%PDF');
  assert.ok(result.body.includes(Buffer.from('%%EOF')));
});
