const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  InvalidReportKeyError,
  createLocalReportStorage,
  getReportStorageDirectory,
} = require('../src/services/report-storage');

test('local report storage writes and reads an opaque PDF key', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-report-storage-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const storage = createLocalReportStorage(root);
  const content = Buffer.from('%PDF-test');

  const stored = await storage.storeReport('audit_123.pdf', content);

  assert.deepEqual(stored, { key: 'audit_123.pdf' });
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
