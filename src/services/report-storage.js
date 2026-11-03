const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

class InvalidReportKeyError extends Error {
  constructor() {
    super('Invalid report storage key.');
    this.name = 'InvalidReportKeyError';
    this.code = 'INVALID_REPORT_KEY';
  }
}

function getReportStorageDirectory(
  configuredDirectory = process.env.REPORT_STORAGE_DIR,
  workingDirectory = process.cwd()
) {
  const configuredPath = typeof configuredDirectory === 'string'
    ? configuredDirectory.trim()
    : '';
  if (configuredPath && !path.isAbsolute(configuredPath)) {
    throw new TypeError('REPORT_STORAGE_DIR must be an absolute path.');
  }
  return path.resolve(configuredPath || workingDirectory, ...(configuredPath ? [] : ['.local-reports']));
}

function resolveReportPath(rootDirectory, key) {
  if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{1,200}\.pdf$/.test(key)) {
    throw new InvalidReportKeyError();
  }
  const root = path.resolve(rootDirectory);
  const filePath = path.resolve(root, key);
  if (path.dirname(filePath) !== root) {
    throw new InvalidReportKeyError();
  }
  return filePath;
}

function createLocalReportStorage(rootDirectory = getReportStorageDirectory()) {
  const absoluteRoot = path.resolve(rootDirectory);

  async function storeReport(key, content) {
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw new TypeError('Report content must be a non-empty PDF buffer.');
    }

    const filePath = resolveReportPath(absoluteRoot, key);
    await fs.mkdir(absoluteRoot, { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(temporaryPath, content, { flag: 'wx' });
      await fs.rename(temporaryPath, filePath);
    } finally {
      await fs.rm(temporaryPath, { force: true });
    }

    return { key };
  }

  async function readReport(key) {
    return fs.readFile(resolveReportPath(absoluteRoot, key));
  }

  return { type: 'local', directory: absoluteRoot, storeReport, readReport };
}

const localReportStorage = createLocalReportStorage();

module.exports = {
  InvalidReportKeyError,
  createLocalReportStorage,
  getReportStorageDirectory,
  localReportStorage,
};
