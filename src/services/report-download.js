const { InvalidReportKeyError, localReportStorage } = require('./report-storage');

function isValidAuditId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}

function errorResponse(status, message) {
  return { status, body: { error: message } };
}

async function getAuditReportDownload(
  auditId,
  prisma,
  storage = localReportStorage
) {
  if (!isValidAuditId(auditId)) {
    return errorResponse(400, 'Invalid audit ID.');
  }

  let audit;
  try {
    audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: {
        report: {
          select: { fileName: true, filePath: true },
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
    const pdf = await storage.readReport(audit.report.filePath);
    const fallbackName = `seo-audit-${auditId}.pdf`;
    const fileName = typeof audit.report.fileName === 'string' &&
      /^seo-audit-[a-zA-Z0-9_-]{1,200}\.pdf$/.test(audit.report.fileName)
      ? audit.report.fileName
      : fallbackName;

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
    if (error instanceof InvalidReportKeyError || (error && error.code === 'ENOENT')) {
      return errorResponse(404, 'Report file not found.');
    }
    console.error('Audit report file read failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : null,
    });
    return errorResponse(500, 'The report file is temporarily unavailable.');
  }
}

module.exports = { getAuditReportDownload, isValidAuditId };
