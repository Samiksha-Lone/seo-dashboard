const test = require('node:test');
const assert = require('node:assert/strict');
const { getPageSpeed } = require('../src/crawlers/pagespeed');
const { getGSCData } = require('../src/crawlers/gsc');
const { getDataForSEO } = require('../src/crawlers/dataforseo');

test('mock crawler integrations return their configured mock data', async () => {
  const [pageSpeed, gsc, dataForSEO] = await Promise.all([
    getPageSpeed('https://example.test', { useMocks: true }),
    getGSCData({ useMocks: true }),
    getDataForSEO({ useMocks: true }),
  ]);

  assert.equal(pageSpeed.categories.performance.score, 0.61);
  assert.equal(gsc.totalClicks, 167);
  assert.equal(dataForSEO.client_rank_position, 4);
});

test('unconfigured live crawler integrations fail explicitly instead of returning undefined', async () => {
  const integrations = [
    () => getPageSpeed('https://example.test', { useMocks: false }),
    () => getGSCData({ useMocks: false }),
    () => getDataForSEO({ useMocks: false }),
  ];

  for (const run of integrations) {
    await assert.rejects(run, (error) => {
      assert.equal(error.code, 'INTEGRATION_NOT_CONFIGURED');
      return true;
    });
  }
});
