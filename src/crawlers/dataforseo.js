const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/dataforseo.mock');

async function getDataForSEO({ useMocks = USE_MOCKS } = {}) {
  if (useMocks) return mockData;

  const error = new Error('DataForSEO integration is not configured.');
  error.code = 'INTEGRATION_NOT_CONFIGURED';
  throw error;
}

module.exports = { getDataForSEO };