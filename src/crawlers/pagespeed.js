const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/pagespeed.mock');

async function getPageSpeed(url, { useMocks = USE_MOCKS } = {}) {
  if (useMocks) return mockData;

  const error = new Error('PageSpeed Insights integration is not configured.');
  error.code = 'INTEGRATION_NOT_CONFIGURED';
  throw error;
}

module.exports = { getPageSpeed };