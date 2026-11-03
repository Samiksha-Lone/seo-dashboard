async function sendWhatsApp({ auditId, clientName, websiteName, reportReference, score }) {
  console.info('[MOCK WHATSAPP] Simulated report notification.', {
    auditId,
    clientName: clientName || 'Client',
    websiteName: websiteName || 'Website',
    score: Number.isInteger(score) ? `${score}/100` : 'Unavailable',
    reportReference,
  });

  return {
    status: 'mock_sent',
    sid: `MOCK_SID_${auditId}`,
  };
}

module.exports = { sendWhatsApp };