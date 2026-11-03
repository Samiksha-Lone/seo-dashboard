const { sendWhatsApp } = require('../mocks/twilio.mock');
const { validateSeoReport } = require('./claude');
const { generatePdfBuffer } = require('./pdf-report');
const { localReportStorage } = require('./report-storage');

function safeErrorDetails(error) {
  return {
    name: error && error.name ? error.name : 'Error',
    code: error && error.code ? error.code : null,
  };
}

async function sendReportNotificationOnce(prisma, auditId, notification, send = sendWhatsApp) {
  try {
    const claim = await prisma.report.updateMany({
      where: { auditId, notificationAttemptedAt: null },
      data: { notificationAttemptedAt: new Date() },
    });
    if (claim.count !== 1) {
      return { status: 'already_attempted' };
    }

    await send(notification);
    console.info('Mock WhatsApp report notification completed.', { auditId });
    return { status: 'mock_sent' };
  } catch (error) {
    console.error('Mock WhatsApp report notification failed; the audit will continue.', {
      auditId,
      ...safeErrorDetails(error),
    });
    return { status: 'failed' };
  }
}

async function generateAndPersistAuditReport(
  prisma,
  auditId,
  {
    renderPdf = generatePdfBuffer,
    storage = localReportStorage,
    notify = sendWhatsApp,
    mockMode = process.env.USE_MOCKS === 'true',
  } = {}
) {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      status: true,
      overallScore: true,
      result: true,
      signals: true,
      createdAt: true,
      startedAt: true,
      website: {
        select: {
          name: true,
          url: true,
          client: {
            select: { businessName: true, businessType: true, city: true, state: true },
          },
        },
      },
    },
  });
  if (!audit) throw new Error('Audit was not found while generating its report.');
  if (!audit.website) throw new Error('Audit website details are unavailable for its report.');

  const report = validateSeoReport(audit.result);
  const fileName = `seo-audit-${audit.id}.pdf`;
  const storageKey = `${audit.id}.pdf`;
  const pdfBuffer = await renderPdf({
    audit,
    report,
    signals: audit.signals,
    mockMode,
  });
  await storage.storeReport(storageKey, pdfBuffer);

  const generatedAt = new Date();
  const metadata = await prisma.report.upsert({
    where: { auditId },
    create: { auditId, fileName, filePath: storageKey, generatedAt },
    update: { fileName, filePath: storageKey, generatedAt },
    select: { id: true, fileName: true, generatedAt: true },
  });

  const notification = await sendReportNotificationOnce(prisma, auditId, {
    auditId,
    clientName: audit.website.client && audit.website.client.businessName,
    reportReference: fileName,
    score: audit.overallScore,
  }, notify);

  return {
    report: metadata,
    storage: storage.type,
    notification: notification.status,
  };
}

module.exports = {
  generateAndPersistAuditReport,
  sendReportNotificationOnce,
};
