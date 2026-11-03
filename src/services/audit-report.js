const { sendEmail } = require('../mocks/email.mock');
const { sendWhatsApp } = require('../mocks/twilio.mock');
const { validateSeoReport } = require('./claude');
const { generatePdfBuffer } = require('./pdf-report');
const { reportStorage } = require('./report-storage');

const MAX_NOTIFICATION_ATTEMPTS = 3;
const NOTIFICATION_CLAIM_LEASE_MS = 30_000;

function safeErrorDetails(error) {
  return {
    name: error && error.name ? error.name : 'Error',
    code: error && error.code ? error.code : null,
  };
}

function channelFields(channel) {
  if (channel === 'email') {
    return {
      attempts: 'emailAttempts',
      claimedAt: 'emailClaimedAt',
      sentAt: 'emailSentAt',
      completedAt: 'emailCompletedAt',
      lastError: 'emailLastError',
    };
  }
  return {
    attempts: 'whatsAppAttempts',
    claimedAt: 'whatsAppClaimedAt',
    sentAt: 'whatsAppSentAt',
    completedAt: 'whatsAppCompletedAt',
    lastError: 'whatsAppLastError',
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function channelLabel(channel) {
  return channel === 'email' ? 'email' : 'WhatsApp';
}

async function sendReportNotificationOnce(
  prisma,
  auditId,
  notification,
  send = sendWhatsApp,
  {
    channel = 'whatsApp',
    maxAttempts = MAX_NOTIFICATION_ATTEMPTS,
    leaseMs = NOTIFICATION_CLAIM_LEASE_MS,
    now = () => new Date(),
    sleep = wait,
  } = {}
) {
  const fields = channelFields(channel);
  const label = channelLabel(channel);
  let attemptNumber = 0;
  try {
    while (attemptNumber < maxAttempts) {
      const claimTime = now();
      const expiredClaim = new Date(claimTime.getTime() - leaseMs);
      const claim = await prisma.report.updateMany({
        where: {
          auditId,
          [fields.completedAt]: null,
          [fields.attempts]: { lt: maxAttempts },
          OR: [
            { [fields.claimedAt]: null },
            { [fields.claimedAt]: { lt: expiredClaim } },
          ],
        },
        data: {
          [fields.attempts]: { increment: 1 },
          [fields.claimedAt]: claimTime,
          [fields.lastError]: null,
          ...(channel === 'whatsApp' ? { notificationAttemptedAt: claimTime } : {}),
        },
      });

      if (claim.count === 0) {
        const state = await prisma.report.findUnique({
          where: { auditId },
          select: {
            [fields.attempts]: true,
            [fields.claimedAt]: true,
            [fields.sentAt]: true,
            [fields.completedAt]: true,
            [fields.lastError]: true,
          },
        });
        if (!state) return { status: 'report_missing' };
        if (state[fields.completedAt]) {
          return {
            status: state[fields.sentAt]
              ? 'already_sent'
              : state[fields.lastError] === 'missing_email'
                ? 'skipped_missing_email'
                : 'already_attempted',
          };
        }
        if (state[fields.attempts] >= maxAttempts) return { status: 'attempts_exhausted' };
        if (!state[fields.claimedAt]) continue;

        const retryAt = state[fields.claimedAt].getTime() + leaseMs;
        const remaining = retryAt - now().getTime();
        if (remaining > 0) {
          await sleep(Math.min(remaining, 250));
        }
        continue;
      }

      const claimedState = await prisma.report.findUnique({
        where: { auditId },
        select: { [fields.attempts]: true },
      });
      attemptNumber = claimedState ? claimedState[fields.attempts] : attemptNumber + 1;
      try {
        const delivery = await send(notification);
        const sent = !delivery || delivery.status !== 'skipped_missing_email';
        const completedAt = now();
        await prisma.report.updateMany({
          where: { auditId, [fields.claimedAt]: claimTime },
          data: {
            [fields.sentAt]: sent ? completedAt : null,
            [fields.completedAt]: completedAt,
            [fields.claimedAt]: null,
            [fields.lastError]: sent ? null : 'missing_email',
          },
        });
        return { status: sent ? 'mock_sent' : 'skipped_missing_email' };
      } catch (error) {
        const details = safeErrorDetails(error);
        const completedAt = attemptNumber >= maxAttempts ? now() : null;
        await prisma.report.updateMany({
          where: { auditId, [fields.claimedAt]: claimTime },
          data: {
            [fields.claimedAt]: null,
            [fields.completedAt]: completedAt,
            [fields.lastError]: `${details.name}${details.code ? ` (${details.code})` : ''}`,
          },
        });
        console.error(`Mock ${label} report notification failed; the audit will continue.`, {
          auditId,
          attempt: attemptNumber,
          ...details,
        });
        if (attemptNumber >= maxAttempts) return { status: 'failed' };
        await sleep(100 * attemptNumber);
      }
    }
    return { status: 'attempts_exhausted' };
  } catch (error) {
    console.error(`Mock ${label} notification tracking failed; the audit will continue.`, {
      auditId,
      ...safeErrorDetails(error),
    });
    return { status: 'tracking_failed' };
  }
}

async function sendReportNotifications(prisma, auditId, notification, {
  notifyWhatsApp = sendWhatsApp,
  notifyEmail = sendEmail,
  ...options
} = {}) {
  const [whatsApp, email] = await Promise.all([
    sendReportNotificationOnce(prisma, auditId, notification, notifyWhatsApp, {
      ...options,
      channel: 'whatsApp',
    }),
    sendReportNotificationOnce(prisma, auditId, notification, notifyEmail, {
      ...options,
      channel: 'email',
    }),
  ]);
  return { whatsApp: whatsApp.status, email: email.status };
}

async function generateAndPersistAuditReport(
  prisma,
  auditId,
  {
    renderPdf = generatePdfBuffer,
    storage = reportStorage,
    notify = sendWhatsApp,
    notifyEmail = sendEmail,
    notificationOptions = {},
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
            select: {
              businessName: true,
              businessType: true,
              city: true,
              state: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!audit) throw new Error('Audit was not found while generating its report.');
  if (!audit.website) throw new Error('Audit website details are unavailable for its report.');

  const report = validateSeoReport(audit.result);
  const fileName = `seo-audit-${audit.id}.pdf`;
  const storageKey = typeof storage.getReportKeyForAudit === 'function'
    ? storage.getReportKeyForAudit(audit.id)
    : `${audit.id}.pdf`;
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

  const notifications = await sendReportNotifications(prisma, auditId, {
    auditId,
    clientEmail: audit.website.client?.user?.email,
    clientName: audit.website.client?.businessName,
    websiteName: audit.website.name,
    auditScore: audit.overallScore,
    score: audit.overallScore,
    reportReference: fileName,
  }, {
    notifyWhatsApp: notify,
    notifyEmail,
    ...notificationOptions,
  });

  return {
    report: metadata,
    storage: storage.type,
    notifications,
  };
}

module.exports = {
  MAX_NOTIFICATION_ATTEMPTS,
  NOTIFICATION_CLAIM_LEASE_MS,
  generateAndPersistAuditReport,
  sendReportNotificationOnce,
  sendReportNotifications,
};
