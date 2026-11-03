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

class ReportObjectNotFoundError extends Error {
  constructor() {
    super('The report object was not found.');
    this.name = 'ReportObjectNotFoundError';
    this.code = 'ENOENT';
  }
}

const REPORT_BUCKET = 'seo-reports';
const REPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRY_SECONDS = 120;

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

function validateAuditId(auditId) {
  if (typeof auditId !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(auditId)) {
    throw new InvalidReportKeyError();
  }
  return auditId;
}

function validateSupabaseObjectPath(key) {
  if (typeof key !== 'string' || !/^audits\/[a-zA-Z0-9_-]{1,200}\/report\.pdf$/.test(key)) {
    throw new InvalidReportKeyError();
  }
  return key;
}

function createSupabaseStorageError(operation, error) {
  if (
    error &&
    (error.statusCode === '404' || error.status === 404 || /object not found/i.test(error.message || ''))
  ) {
    return new ReportObjectNotFoundError();
  }

  const storageError = new Error(`Supabase report storage ${operation} failed.`);
  storageError.name = 'ReportStorageError';
  storageError.code = 'SUPABASE_STORAGE_ERROR';
  return storageError;
}

function createLocalReportStorage(rootDirectory = getReportStorageDirectory()) {
  const absoluteRoot = path.resolve(rootDirectory);

  function getReportKeyForAudit(auditId) {
    return `${validateAuditId(auditId)}.pdf`;
  }

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

  return {
    type: 'local',
    directory: absoluteRoot,
    getReportKeyForAudit,
    storeReport,
    readReport,
  };
}

function createSupabaseReportStorage({
  supabaseUrl = process.env.SUPABASE_URL,
  secretKey = process.env.SUPABASE_SECRET_KEY,
  createClient = require('@supabase/supabase-js').createClient,
} = {}) {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    throw new TypeError('SUPABASE_URL is required for Supabase report storage.');
  }
  if (typeof secretKey !== 'string' || !secretKey.trim()) {
    throw new TypeError('SUPABASE_SECRET_KEY is required for Supabase report storage.');
  }
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  async function verifyBucketConfiguration() {
    const { data, error } = await supabase.storage.getBucket(REPORT_BUCKET);
    if (error || !data) {
      const storageError = new Error('Unable to verify the Supabase report bucket.');
      storageError.name = 'ReportStorageError';
      storageError.code = 'SUPABASE_BUCKET_CHECK_FAILED';
      throw storageError;
    }
    if (data.public !== false) {
      const storageError = new Error('The Supabase report bucket must be private.');
      storageError.name = 'ReportStorageConfigurationError';
      storageError.code = 'SUPABASE_BUCKET_NOT_PRIVATE';
      throw storageError;
    }
    if (
      !Array.isArray(data.allowed_mime_types) ||
      data.allowed_mime_types.length !== 1 ||
      data.allowed_mime_types[0] !== 'application/pdf'
    ) {
      const storageError = new Error('The Supabase report bucket must allow only PDF files.');
      storageError.name = 'ReportStorageConfigurationError';
      storageError.code = 'SUPABASE_BUCKET_MIME_TYPE_MISMATCH';
      throw storageError;
    }
    if (data.file_size_limit !== REPORT_MAX_FILE_SIZE_BYTES) {
      const storageError = new Error('The Supabase report bucket must have a 10 MB file size limit.');
      storageError.name = 'ReportStorageConfigurationError';
      storageError.code = 'SUPABASE_BUCKET_FILE_SIZE_MISMATCH';
      throw storageError;
    }
  }

  function getReportKeyForAudit(auditId) {
    return `audits/${validateAuditId(auditId)}/report.pdf`;
  }

  async function storeReport(key, content) {
    validateSupabaseObjectPath(key);
    if (!Buffer.isBuffer(content) || content.length === 0) {
      throw new TypeError('Report content must be a non-empty PDF buffer.');
    }
    if (content.length > REPORT_MAX_FILE_SIZE_BYTES) {
      throw new TypeError('Report content exceeds the 10 MB storage limit.');
    }
    await verifyBucketConfiguration();

    const { error } = await supabase.storage
      .from(REPORT_BUCKET)
      .upload(key, content, {
        cacheControl: '3600',
        contentType: 'application/pdf',
        upsert: true,
      });
    if (error) throw createSupabaseStorageError('upload', error);

    return { key, bucket: REPORT_BUCKET };
  }

  async function createSignedDownloadUrl(key, fileName) {
    validateSupabaseObjectPath(key);
    if (
      typeof fileName !== 'string' ||
      fileName.length > 200 ||
      /[\r\n"]/u.test(fileName)
    ) {
      throw new TypeError('A safe report download filename is required.');
    }

    await verifyBucketConfiguration();
    const { data, error } = await supabase.storage
      .from(REPORT_BUCKET)
      .createSignedUrl(key, SIGNED_URL_EXPIRY_SECONDS, { download: fileName });
    if (error) throw createSupabaseStorageError('signed URL generation', error);
    if (!data || typeof data.signedUrl !== 'string' || !data.signedUrl) {
      throw new Error('Supabase did not return a signed report URL.');
    }
    return data.signedUrl;
  }

  return {
    type: 'supabase',
    bucket: REPORT_BUCKET,
    signedUrlExpirySeconds: SIGNED_URL_EXPIRY_SECONDS,
    getReportKeyForAudit,
    storeReport,
    createSignedDownloadUrl,
  };
}

function createUnconfiguredReportStorage() {
  function getReportKeyForAudit(auditId) {
    return `audits/${validateAuditId(auditId)}/report.pdf`;
  }

  function throwConfigurationError() {
    const error = new Error(
      'Configure SUPABASE_URL and SUPABASE_SECRET_KEY to use report storage in production.'
    );
    error.name = 'ReportStorageConfigurationError';
    error.code = 'REPORT_STORAGE_CONFIG_MISSING';
    throw error;
  }

  return {
    type: 'supabase',
    bucket: REPORT_BUCKET,
    getReportKeyForAudit,
    async storeReport() {
      throwConfigurationError();
    },
    async createSignedDownloadUrl() {
      throwConfigurationError();
    },
  };
}

function createDefaultReportStorage(environment = process.env) {
  const supabaseUrl = environment.SUPABASE_URL;
  const secretKey = environment.SUPABASE_SECRET_KEY;
  if (supabaseUrl && secretKey) {
    return createSupabaseReportStorage({ supabaseUrl, secretKey });
  }
  if (
    supabaseUrl ||
    secretKey ||
    environment.NODE_ENV === 'production' ||
    environment.VERCEL
  ) {
    return createUnconfiguredReportStorage();
  }
  return localReportStorage;
}

const localReportStorage = createLocalReportStorage();
const reportStorage = createDefaultReportStorage();

module.exports = {
  InvalidReportKeyError,
  REPORT_BUCKET,
  REPORT_MAX_FILE_SIZE_BYTES,
  ReportObjectNotFoundError,
  SIGNED_URL_EXPIRY_SECONDS,
  createDefaultReportStorage,
  createLocalReportStorage,
  createSupabaseReportStorage,
  createUnconfiguredReportStorage,
  getReportStorageDirectory,
  localReportStorage,
  reportStorage,
};
