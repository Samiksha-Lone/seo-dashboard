const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/dataforseo.mock');

async function getDataForSEO() {
  if (USE_MOCKS) return mockData;

  // Real DataForSEO API call goes here
}

module.exports = { getDataForSEO };