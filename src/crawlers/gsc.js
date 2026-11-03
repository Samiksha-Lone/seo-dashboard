const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/gsc.mock');

async function getGSCData({ useMocks = USE_MOCKS } = {}) {
  if (useMocks) return mockData;

  const error = new Error('Google Search Console integration is not configured.');
  error.code = 'INTEGRATION_NOT_CONFIGURED';
  throw error;
}

module.exports = { getGSCData };