const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/gsc.mock');

async function getGSCData() {
  if (USE_MOCKS) return mockData;

  // Real Google Search Console API call goes here
}

module.exports = { getGSCData };