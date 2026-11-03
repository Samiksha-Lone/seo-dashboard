const test = require('node:test');
const assert = require('node:assert/strict');
const { createReportHtml, generatePdfBuffer } = require('../src/services/pdf-report');

const report = {
  overall_score: 81,
  score_breakdown: {
    technical: 80,
    on_page: 82,
    content: 75,
    core_web_vitals: 90,
    schema: 78,
  },
  executive_summary: 'A practical summary.',
  critical_issues: [{
    title: 'Critical item',
    category: 'technical',
    finding: 'Finding text',
    fix: 'Exact critical fix',
    estimated_impact: 'High',
    effort: 'Days',
    falsifiability_check: 'Confirm the error is gone',
  }],
  important_issues: [],
  quick_wins: [],
  recommendations: [{
    priority: 'HIGH',
    category: 'technical',
    finding: 'Recommendation finding',
    fix: 'Recommendation exact fix',
    estimated_impact: 'High',
    effort: 'Days',
    falsifiability_check: 'Compare before and after',
  }],
};

function fakeBrowser({ failOn = '' } = {}) {
  const state = { closed: false, html: '', options: null };
  const browser = {
    async newPage() {
      return {
        async setContent(html) {
          state.html = html;
          if (failOn === 'setContent') throw new Error('render failed');
        },
        async pdf(options) {
          state.options = options;
          if (failOn === 'pdf') throw new Error('pdf failed');
          return Buffer.from('%PDF-mock');
        },
      };
    },
    async close() {
      state.closed = true;
    },
  };
  return { state, puppeteer: { async launch() { return browser; } } };
}

test('report HTML includes required sections and escapes untrusted content', () => {
  const html = createReportHtml({
    audit: {
      createdAt: new Date('2026-11-03T00:00:00.000Z'),
      website: {
        name: '<script>alert(1)</script>',
        url: 'https://example.test/?q=<img src=x>',
        client: { businessName: 'A & B', businessType: 'Services', city: 'Pune', state: 'MH' },
      },
    },
    report: {
      ...report,
      executive_summary: '<img src=x onerror=alert(1)>',
      critical_issues: [{
        ...report.critical_issues[0],
        fix: '<b>Injected</b>',
      }],
    },
    signals: { crawl: { status: 'success' }, gsc: { status: 'error' } },
    mockMode: true,
  });

  for (const section of [
    'Score breakdown',
    'Executive summary',
    'Critical issues',
    'Important issues',
    'Quick wins',
    'Prioritized recommendations',
    'Signal availability',
    'Exact fix',
    'Falsifiability check',
  ]) {
    assert.ok(html.includes(section), `missing section: ${section}`);
  }
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;b&gt;Injected&lt;/b&gt;'));
  assert.ok(html.includes('Unavailable signals: gsc.'));
  assert.ok(html.includes('Mock mode is enabled.'));
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
});

test('report HTML handles absent optional fields without throwing', () => {
  const html = createReportHtml({ audit: {}, report: {}, signals: null });
  assert.ok(html.includes('Website audit'));
  assert.ok(html.includes('Not available'));
  assert.ok(html.includes('No critical issues were identified.'));
  assert.ok(html.includes('No recommendations are available'));
});

test('Puppeteer browser is closed after a successful PDF render', async () => {
  const { state, puppeteer } = fakeBrowser();
  const pdf = await generatePdfBuffer({ audit: {}, report }, puppeteer);
  assert.equal(pdf.toString(), '%PDF-mock');
  assert.equal(state.closed, true);
  assert.equal(state.options.format, 'A4');
  assert.equal(state.options.displayHeaderFooter, true);
});

test('Puppeteer browser is closed when page rendering fails', async () => {
  const { state, puppeteer } = fakeBrowser({ failOn: 'setContent' });
  await assert.rejects(generatePdfBuffer({ audit: {}, report }, puppeteer), /render failed/);
  assert.equal(state.closed, true);
});
