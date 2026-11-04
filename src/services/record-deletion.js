const ACTIVE_AUDIT_STATUSES = ['QUEUED', 'PROCESSING'];

class RecordDeletionError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'RecordDeletionError';
    this.statusCode = statusCode;
  }
}

function getAuditRecords(audits) {
  return Array.isArray(audits) ? audits : [];
}

function assertNoActiveAudits(audits, type) {
  if (getAuditRecords(audits).some((audit) => ACTIVE_AUDIT_STATUSES.includes(audit.status))) {
    throw new RecordDeletionError(
      `This ${type} has an audit in progress. Wait for active audits to finish before deleting it.`,
      409,
    );
  }
}

async function removeAuditRecords(transaction, auditId) {
  await transaction.auditIssue.deleteMany({ where: { auditId } });
  await transaction.auditRecommendation.deleteMany({ where: { auditId } });
  await transaction.report.deleteMany({ where: { auditId } });
  const result = await transaction.audit.deleteMany({
    where: { id: auditId, status: { notIn: ACTIVE_AUDIT_STATUSES } },
  });

  if (result.count !== 1) {
    throw new RecordDeletionError(
      'An audit became active while deletion was in progress. Wait for it to finish and try again.',
      409,
    );
  }
}

async function cleanupReports(reportPaths, storage, resourceId) {
  let failures = 0;

  for (const filePath of reportPaths) {
    try {
      if (!filePath || typeof storage.deleteReport !== 'function') {
        throw new Error('Report storage does not support object cleanup.');
      }
      await storage.deleteReport(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      failures += 1;
      console.error('Report object cleanup failed after record deletion:', {
        resourceId,
        name: error?.name || 'Error',
        code: error?.code || 'UNKNOWN',
      });
    }
  }

  return failures;
}

async function deleteAudit(prisma, auditId, { storage }) {
  const reportPaths = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "Audit" WHERE "id" = ${auditId} FOR UPDATE
    `;
    const audit = await transaction.audit.findUnique({
      where: { id: auditId },
      select: {
        id: true,
        status: true,
        report: { select: { filePath: true } },
      },
    });

    if (!audit) {
      throw new RecordDeletionError('Audit not found.', 404);
    }
    assertNoActiveAudits([audit], 'audit');
    await removeAuditRecords(transaction, audit.id);
    return audit.report ? [audit.report.filePath] : [];
  }, { isolationLevel: 'Serializable' });

  return {
    id: auditId,
    storageCleanupFailures: await cleanupReports(reportPaths, storage, auditId),
  };
}

async function deleteWebsite(prisma, websiteId, { storage }) {
  const reportPaths = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "Website" WHERE "id" = ${websiteId} FOR UPDATE
    `;
    const website = await transaction.website.findUnique({
      where: { id: websiteId },
      select: {
        id: true,
        audits: {
          select: {
            id: true,
            status: true,
            report: { select: { filePath: true } },
          },
        },
      },
    });

    if (!website) {
      throw new RecordDeletionError('Website not found.', 404);
    }
    assertNoActiveAudits(website.audits, 'website');

    const paths = [];
    for (const audit of website.audits) {
      if (audit.report) paths.push(audit.report.filePath);
      await removeAuditRecords(transaction, audit.id);
    }
    await transaction.website.delete({ where: { id: website.id } });
    return paths;
  }, { isolationLevel: 'Serializable' });

  return {
    id: websiteId,
    storageCleanupFailures: await cleanupReports(reportPaths, storage, websiteId),
  };
}

async function deleteClient(prisma, clientId, { storage }) {
  const reportPaths = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "Website" WHERE "clientId" = ${clientId} FOR UPDATE
    `;
    const client = await transaction.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        websites: {
          select: {
            id: true,
            audits: {
              select: {
                id: true,
                status: true,
                report: { select: { filePath: true } },
              },
            },
          },
        },
      },
    });

    if (!client) {
      throw new RecordDeletionError('Client not found.', 404);
    }
    assertNoActiveAudits(
      client.websites.flatMap((website) => website.audits),
      'client',
    );

    const paths = [];
    for (const website of client.websites) {
      for (const audit of website.audits) {
        if (audit.report) paths.push(audit.report.filePath);
        await removeAuditRecords(transaction, audit.id);
      }
      await transaction.website.delete({ where: { id: website.id } });
    }
    await transaction.client.delete({ where: { id: client.id } });
    return paths;
  }, { isolationLevel: 'Serializable' });

  return {
    id: clientId,
    storageCleanupFailures: await cleanupReports(reportPaths, storage, clientId),
  };
}

module.exports = {
  RecordDeletionError,
  deleteAudit,
  deleteClient,
  deleteWebsite,
};
