const { USE_MOCKS } = require('../mocks');
const mockData = require('../mocks/pagespeed.mock');

async function getPageSpeed(url) {
  if (USE_MOCKS) return mockData;

  // Real PageSpeed Insights API call goes here
}

module.exports = { getPageSpeed };