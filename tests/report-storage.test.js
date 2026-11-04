const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  InvalidReportKeyError,
  REPORT_BUCKET,
  REPORT_MAX_FILE_SIZE_BYTES,
  ReportObjectNotFoundError,
  SIGNED_URL_EXPIRY_SECONDS,
  createLocalReportStorage,
  createSupabaseReportStorage,
  createDefaultReportStorage,
  getReportStorageDirectory,
  getReportStorageType,
} = require('../src/services/report-storage');

test('local report storage writes and reads an opaque PDF key', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-report-storage-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const storage = createLocalReportStorage(root);
  const content = Buffer.from('%PDF-test');

  const stored = await storage.storeReport('audit_123.pdf', content);

  assert.deepEqual(stored, { key: 'audit_123.pdf' });
  assert.equal(storage.getReportKeyForAudit('audit_123'), 'audit_123.pdf');
  assert.deepEqual(await storage.readReport(stored.key), content);
});

test('local report storage rejects traversal keys', async () => {
  const storage = createLocalReportStorage();
  await assert.rejects(
    storage.readReport('../secret.pdf'),
    InvalidReportKeyError
  );
  await assert.rejects(
    storage.readReport('..%2fsecret.pdf'),
    InvalidReportKeyError
  );
});

test('storage directory is project-local by default and configurable only by absolute path', () => {
  assert.equal(
    getReportStorageDirectory('', 'D:\\workspace\\seo-dashboard'),
    path.join('D:\\workspace\\seo-dashboard', '.local-reports')
  );
  assert.equal(
    getReportStorageDirectory('E:\\shared\\seo-reports', 'D:\\workspace\\seo-dashboard'),
    path.normalize('E:\\shared\\seo-reports')
  );
  assert.throws(
    () => getReportStorageDirectory('relative\\reports', 'D:\\workspace\\seo-dashboard'),
    /must be an absolute path/
  );
});

test('report storage metadata recognizes the existing Supabase key convention', () => {
  assert.equal(getReportStorageType('audits/audit_123/report.pdf'), 'supabase');
  assert.equal(getReportStorageType('audit_123.pdf'), 'local');
  assert.equal(getReportStorageType('../report.pdf'), 'unknown');
});

test('Supabase report storage uploads PDFs to a private-bucket object path', async () => {
  const calls = [];
  const storage = createSupabaseReportStorage({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: 'sb_secret_test-only-not-real',
    createClient(url, key, options) {
      assert.equal(url, 'https://project.supabase.co');
      assert.equal(key, 'sb_secret_test-only-not-real');
      assert.deepEqual(options.auth, {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      });
      return {
        storage: {
          async getBucket(bucket) {
            assert.equal(bucket, REPORT_BUCKET);
            return {
              data: {
                public: false,
                allowed_mime_types: ['application/pdf'],
                file_size_limit: REPORT_MAX_FILE_SIZE_BYTES,
              },
              error: null,
            };
          },
          from(bucket) {
            assert.equal(bucket, REPORT_BUCKET);
            return {
              async upload(...args) {
                calls.push(args);
                return { data: { path: args[0] }, error: null };
              },
            };
          },
        },
      };
    },
  });
  const pdf = Buffer.from('%PDF-test');

  const result = await storage.storeReport(storage.getReportKeyForAudit('audit_123'), pdf);

  assert.deepEqual(result, { key: 'audits/audit_123/report.pdf', bucket: 'seo-reports' });
  assert.deepEqual(calls, [[
    'audits/audit_123/report.pdf',
    pdf,
    { cacheControl: '3600', contentType: 'application/pdf', upsert: true },
  ]]);
});

test('Supabase upload failures are reported without exposing provider messages', async () => {
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
        from: () => ({
          async upload() {
            return { data: null, error: { message: 'provider detail', statusCode: '500' } };
          },
        }),
      },
    }),
  });

  await assert.rejects(
    storage.storeReport('audits/audit_123/report.pdf', Buffer.from('%PDF-test')),
    (error) => {
      assert.equal(error.name, 'ReportStorageError');
      assert.equal(error.code, 'SUPABASE_STORAGE_ERROR');
      assert.equal(error.message.includes('provider detail'), false);
      return true;
    }
  );
});

test('Supabase storage rejects missing objects and invalid paths', async () => {
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
        from: () => ({
          async createSignedUrl() {
            return { data: null, error: { message: 'Object not found', statusCode: '404' } };
          },
        }),
      },
    }),
  });

  await assert.rejects(
    storage.createSignedDownloadUrl('audits/audit_123/report.pdf', 'report.pdf'),
    ReportObjectNotFoundError
  );
  await assert.rejects(
    storage.storeReport('audits/../report.pdf', Buffer.from('%PDF-test')),
    InvalidReportKeyError
  );
});

test('Supabase report storage refuses to use a public bucket', async () => {
  const storage = createSupabaseReportStorage({
    supabaseUrl: 'https://project.supabase.co',
    secretKey: 'sb_secret_test-only-not-real',
    createClient: () => ({
      storage: {
        async getBucket() {
          return { data: { public: true }, error: null };
        },
        from() {
          throw new Error('Public buckets must not be used.');
        },
      },
    }),
  });

  await assert.rejects(
    storage.storeReport('audits/audit_123/report.pdf', Buffer.from('%PDF-test')),
    { code: 'SUPABASE_BUCKET_NOT_PRIVATE' }
  );
});

test('Supabase report storage refuses buckets without the PDF-only 10 MB restrictions', async () => {
  for (const bucket of [
    { public: false, allowed_mime_types: ['application/pdf', 'image/png'], file_size_limit: REPORT_MAX_FILE_SIZE_BYTES },
    { public: false, allowed_mime_types: ['application/pdf'], file_size_limit: null },
    { public: false, allowed_mime_types: ['application/pdf'], file_size_limit: REPORT_MAX_FILE_SIZE_BYTES + 1 },
  ]) {
    const storage = createSupabaseReportStorage({
      supabaseUrl: 'https://project.supabase.co',
      secretKey: 'sb_secret_test-only-not-real',
      createClient: () => ({
        storage: {
          async getBucket() {
            return { data: bucket, error: null };
          },
          from() {
            throw new Error('Invalid bucket configuration must not be used.');
          },
        },
      }),
    });

    await assert.rejects(
      storage.storeReport('audits/audit_123/report.pdf', Buffer.from('%PDF-test')),
      { code: bucket.allowed_mime_types?.length !== 1
        ? 'SUPABASE_BUCKET_MIME_TYPE_MISMATCH'
        : 'SUPABASE_BUCKET_FILE_SIZE_MISMATCH' }
    );
  }
});

test('Supabase signed URL uses the fixed 120-second expiry and attachment name', async () => {
  let signedUrlArguments;
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
        from(bucket) {
          assert.equal(bucket, REPORT_BUCKET);
          return {
            async createSignedUrl(...args) {
              signedUrlArguments = args;
              return { data: { signedUrl: 'https://signed.example.test/report' }, error: null };
            },
          };
        },
      },
    }),
  });

  const signedUrl = await storage.createSignedDownloadUrl(
    'audits/audit_123/report.pdf',
    'SEO-Audit-Example-2026-11-03.pdf'
  );

  assert.equal(signedUrl, 'https://signed.example.test/report');
  assert.equal(storage.signedUrlExpirySeconds, SIGNED_URL_EXPIRY_SECONDS);
  assert.deepEqual(signedUrlArguments, [
    'audits/audit_123/report.pdf',
    120,
    { download: 'SEO-Audit-Example-2026-11-03.pdf' },
  ]);
});

test('production uses Supabase storage and never silently falls back to local disk', async () => {
  assert.equal(
    createDefaultReportStorage({ NODE_ENV: 'development' }).type,
    'local'
  );
  const productionStorage = createDefaultReportStorage({ NODE_ENV: 'production' });
  assert.equal(productionStorage.type, 'supabase');
  await assert.rejects(
    productionStorage.storeReport('audits/audit_123/report.pdf', Buffer.from('%PDF-test')),
    { code: 'REPORT_STORAGE_CONFIG_MISSING' }
  );
  const partialConfiguration = createDefaultReportStorage({
    NODE_ENV: 'development',
    SUPABASE_URL: 'https://project.supabase.co',
  });
  assert.equal(partialConfiguration.type, 'supabase');
  await assert.rejects(
    partialConfiguration.createSignedDownloadUrl('audits/audit_123/report.pdf', 'report.pdf'),
    { code: 'REPORT_STORAGE_CONFIG_MISSING' }
  );
  assert.equal(
    createDefaultReportStorage({
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test-only-not-real',
    }).type,
    'supabase'
  );
});
