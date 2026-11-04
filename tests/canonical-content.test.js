const test = require('node:test');
const assert = require('node:assert/strict');
const { crawlWebsite } = require('../src/crawlers/website');
const { analyzeOnPage } = require('../src/analyzers/on-page');
const { buildMockSeoReport, scoreBreakdownFromSignals } = require('../src/services/claude');
const safeFetchModule = require('../src/crawlers/safe-fetch');

async function withMockedFetch(html, callback) {
  const original = safeFetchModule.safeFetch;
  safeFetchModule.safeFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => html,
  });

  try {
    return await callback();
  } finally {
    safeFetchModule.safeFetch = original;
  }
}

test('crawlWebsite captures a valid absolute canonical URL', async () => {
  await withMockedFetch(`
    <html>
      <head>
        <title>Dental Clinic</title>
        <meta name="description" content="Dental clinic in Pune" />
        <link rel="canonical" href="https://example.com/clinic" />
      </head>
      <body>
        <h1>Dental Clinic</h1>
        <p>Modern dental care and smile design.</p>
      </body>
    </html>
  `, async () => {
    const result = await crawlWebsite('https://example.com/page');
    assert.equal(result.canonical.present, true);
    assert.equal(result.canonical.valid, true);
    assert.equal(result.canonical.resolvedUrl, 'https://example.com/clinic');
    assert.equal(result.canonical.mismatch, false);
    assert.equal(result.content.wordCount > 0, true);
  });
});

test('crawlWebsite exposes a missing canonical tag as a valid signal', async () => {
  await withMockedFetch(`
    <html>
      <head>
        <title>Dental Clinic</title>
        <meta name="description" content="Dental clinic in Pune" />
      </head>
      <body>
        <h1>Dental Clinic</h1>
        <p>We offer gentle dental treatment and smile correction.</p>
      </body>
    </html>
  `, async () => {
    const result = await crawlWebsite('https://example.com/page');
    assert.equal(result.canonical.present, false);
    assert.equal(result.canonical.value, '');
  });
});

test('analyzeOnPage flags invalid canonical values', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/page',
    title: 'Example page',
    description: 'Example description',
    headings: { h1: ['Example'], h2: ['Services'] },
    content: { text: 'Example text for a page with useful content.', wordCount: 10, paragraphCount: 1, headingCount: 2, hasMeaningfulContent: true, isThin: true, isEmpty: false },
    canonical: 'http://[bad-url',
    images: [],
  });

  assert.equal(result.checks.canonical.present, true);
  assert.equal(result.checks.canonical.valid, false);
  assert.ok(result.issues.some((issue) => issue.finding.toLowerCase().includes('invalid')));
});

test('analyzeOnPage resolves relative canonical URLs against the audited page', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/landing',
    title: 'Landing page',
    description: 'Landing page description',
    headings: { h1: ['Landing page'], h2: ['Offer'] },
    content: { text: 'Strong landing page copy with enough content to be useful.', wordCount: 150, paragraphCount: 2, headingCount: 2, hasMeaningfulContent: true, isThin: false, isEmpty: false },
    canonical: '/services/landing',
    images: [],
  });

  assert.equal(result.checks.canonical.relative, true);
  assert.equal(result.checks.canonical.resolvedUrl, 'https://example.com/services/landing');
  assert.equal(result.checks.canonical.mismatch, false);
});

test('healthy page content is measured as meaningful and scores above the neutral baseline', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/clinic',
    title: 'Clinic',
    description: 'Description',
    headings: { h1: ['Dental clinic'], h2: ['Treatments'] },
    content: {
      text: 'We provide preventive care, cosmetic dentistry, and smile makeovers with modern technology and a patient-first approach across every consultation.',
      wordCount: 240,
      paragraphCount: 3,
      headingCount: 2,
      hasMeaningfulContent: true,
      isThin: false,
      isEmpty: false,
    },
    canonical: 'https://example.com/clinic',
    images: [],
  });

  assert.equal(result.checks.content.meaningful, true);
  assert.equal(result.checks.content.empty, false);
  assert.equal(result.checks.content.thin, false);

  const scores = scoreBreakdownFromSignals({ onPage: { status: 'success', data: result } });
  assert.ok(scores.scores.content > 50, `expected content score > 50 but got ${scores.scores.content}`);
});

test('very thin content is flagged as weak content', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/short-page',
    title: 'Short page',
    description: 'Short page description',
    headings: { h1: ['Short page'] },
    content: { text: 'A few words only.', wordCount: 18, paragraphCount: 1, headingCount: 1, hasMeaningfulContent: false, isThin: true, isEmpty: false },
    canonical: 'https://example.com/short-page',
    images: [],
  });

  assert.equal(result.checks.content.thin, true);
  assert.ok(result.issues.some((issue) => issue.finding.toLowerCase().includes('very thin')));
});

test('empty or nearly empty content is treated as a content issue', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/empty-page',
    title: 'Empty page',
    description: 'Empty page description',
    headings: { h1: ['Empty page'] },
    content: { text: '', wordCount: 0, paragraphCount: 0, headingCount: 1, hasMeaningfulContent: false, isThin: false, isEmpty: true },
    canonical: 'https://example.com/empty-page',
    images: [],
  });

  assert.equal(result.checks.content.empty, true);
  assert.ok(result.issues.some((issue) => issue.finding.toLowerCase().includes('little or no meaningful visible text')));
});

test('missing content data is handled gracefully without throwing', () => {
  const result = analyzeOnPage({
    url: 'https://example.com/no-body',
    title: 'No body',
    description: 'No description',
    headings: { h1: ['No body'] },
    canonical: 'https://example.com/no-body',
    images: [],
  });

  assert.equal(result.checks.content.wordCount, 0);
  assert.equal(result.checks.content.empty, true);
  assert.ok(Array.isArray(result.issues));
});

test('mock report keeps content score non-neutral when meaningful content is measured', () => {
  const report = buildMockSeoReport({
    onPage: {
      status: 'success',
      data: analyzeOnPage({
        url: 'https://example.com/quality',
        title: 'Quality page',
        description: 'Health content',
        headings: { h1: ['Quality page'], h2: ['Why it matters'] },
        content: { text: 'This page has enough original content to be considered useful for search and for users.', wordCount: 220, paragraphCount: 3, headingCount: 2, hasMeaningfulContent: true, isThin: false, isEmpty: false },
        canonical: 'https://example.com/quality',
        images: [],
      }),
    },
  });

  assert.ok(report.score_breakdown.content > 50, `expected a measured content score above 50, got ${report.score_breakdown.content}`);
  assert.ok(report.executive_summary.length > 0);
});
