async function sendEmail({
  clientEmail,
  clientName,
  websiteName,
  auditScore,
  reportReference,
}) {
  const recipient = typeof clientEmail === 'string' ? clientEmail.trim() : '';
  if (!recipient) {
    console.info('[MOCK EMAIL] Simulated report email skipped; client email is unavailable.', {
      clientName: clientName || 'Client',
      websiteName: websiteName || 'Website',
      reportReference,
    });
    return { channel: 'email', status: 'skipped_missing_email' };
  }

  console.info('[MOCK EMAIL] Simulated report email delivery.', {
    to: recipient,
    clientName: clientName || 'Client',
    websiteName: websiteName || 'Website',
    auditScore: Number.isInteger(auditScore) ? `${auditScore}/100` : 'Unavailable',
    reportReference,
  });
  return { channel: 'email', status: 'mock_sent' };
}

module.exports = { sendEmail };
