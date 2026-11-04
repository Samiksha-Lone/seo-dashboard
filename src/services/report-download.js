const {
  InvalidReportKeyError,
  ReportObjectNotFoundError,
  reportStorage,
} = require('./report-storage');

function isValidAuditId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}

function errorResponse(status, message) {
  return { status, body: { error: message } };
}

function createDownloadFileName(websiteName, auditDate) {
  const date = auditDate instanceof Date && !Number.isNaN(auditDate.getTime())
    ? auditDate.toISOString().slice(0, 10)
    : 'unknown-date';
  const safeWebsiteName = typeof websiteName === 'string'
    ? websiteName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '')
    : '';

  return `SEO-Audit-${safeWebsiteName || 'Report'}-${date}.pdf`;
}

async function getAuditReportDownload(
  auditId,
  prisma,
  storage = reportStorage,
  { user } = {}
) {
  if (!isValidAuditId(auditId)) {
    return errorResponse(400, 'Invalid audit ID.');
  }

  let audit;
  try {
    if (user && user.role === 'CLIENT' && !user.clientId) {
      return errorResponse(404, 'Report not found.');
    }
    const where = { id: auditId };
    if (user && user.role === 'CLIENT') {
      where.website = { clientId: user.clientId };
    }
    audit = await prisma.audit.findFirst({
      where,
      select: {
        createdAt: true,
        website: {
          select: {
            name: true,
            client: { select: { businessName: true } },
          },
        },
        report: {
          select: { filePath: true },
        },
      },
    });
  } catch (error) {
    console.error('Audit report lookup failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
    });
    return errorResponse(500, 'The report is temporarily unavailable.');
  }

  if (!audit || !audit.report) {
    return errorResponse(404, 'Report not found.');
  }

  try {
    const businessName = audit.website && audit.website.client && audit.website.client.businessName;
    const fileName = createDownloadFileName(
      businessName || (audit.website && audit.website.name),
      audit.createdAt
    );
    if (typeof storage.createSignedDownloadUrl === 'function') {
      const signedUrl = await storage.createSignedDownloadUrl(audit.report.filePath, fileName);
      return {
        status: 302,
        body: null,
        headers: {
          Location: signedUrl,
          'Cache-Control': 'private, no-store',
        },
      };
    }

    const pdf = await storage.readReport(audit.report.filePath);

    return {
      status: 200,
      body: pdf,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    };
  } catch (error) {
    if (
      error instanceof InvalidReportKeyError ||
      error instanceof ReportObjectNotFoundError ||
      (error && error.code === 'ENOENT')
    ) {
      return errorResponse(404, 'Report file not found.');
    }
    console.error('Audit report file read failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
    });
    return errorResponse(500, 'The report file is temporarily unavailable.');
  }
}

module.exports = { createDownloadFileName, getAuditReportDownload, isValidAuditId };
