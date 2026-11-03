process.env.USE_MOCKS = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildMockSeoReport,
  buildUserPrompt,
  generateSeoReport,
  validateSeoReport,
  calculateSchemaScore,
  scoreBreakdownFromSignals,
  ReportValidationError,
  ClaudeServiceError,
} = require('../src/services/claude');

function validReport() {
  return {
    audit_version: 'v1.0',
    overall_score: 80,
    score_breakdown: {
      technical: 80,
      on_page: 81,
      content: 78,
      core_web_vitals: 82,
      schema: 79,
    },
    critical_issues: [],
    important_issues: [],
    quick_wins: [{
      category: 'OnPage',
      title: 'Add image alternative text',
      finding: 'An image does not have alternative text.',
      fix: 'Add concise, descriptive alt text.',
      estimated_impact: 'Low',
      effort: 'Hours',
      effort_hours: 1,
      falsifiability_check: 'Re-run the image analysis.',
    }],
    recommendations: [{
      priority: 'CRITICAL',
      category: 'Technical',
      finding: 'A critical technical problem was measured.',
      fix: 'Resolve the measured problem.',
      estimated_impact: 'High',
      effort: 'Days',
      falsifiability_check: 'Repeat the technical check.',
    }],
    executive_summary: 'The available signals identify one finding.',
  };
}

test('prompt includes business context and each assessment signal section', () => {
  const prompt = buildUserPrompt({
    onPage: { status: 'success', data: { title: 'Clinic' } },
    robotsSitemap: { status: 'error', error: { message: 'unavailable' } },
    pageSpeed: { status: 'success', data: { score: 0.8 } },
    schema: { status: 'success', data: { totalBlocks: 1 } },
    googleSearchConsole: { status: 'success', data: { clicks: 4 } },
    dataForSEO: { status: 'success', data: { rank: 3 } },
  }, {
    url: 'https://clinic.example',
    businessType: 'Dental clinic',
    city: 'Pune',
    state: 'Maharashtra',
  });

  assert.match(prompt, /Business type: Dental clinic/);
  assert.match(prompt, /Business location: Pune, Maharashtra, India/);
  assert.match(prompt, /=== ON-PAGE DATA ===/);
  assert.match(prompt, /=== TECHNICAL DATA ===/);
  assert.match(prompt, /=== CORE WEB VITALS ===/);
  assert.match(prompt, /=== SCHEMA\.ORG DATA ===/);
  assert.match(prompt, /=== GOOGLE SEARCH CONSOLE ===/);
  assert.match(prompt, /=== KEYWORD RANKINGS ===/);
  assert.match(prompt, /"status":"error","data":null/);
  assert.throws(
    () => buildUserPrompt({}, { url: 'https://clinic.example' }),
    (error) => error instanceof ClaudeServiceError &&
      error.code === 'MISSING_AUDIT_CONTEXT'
  );
});

test('mock report follows the schema and emits a storable critical priority', async () => {
  const signals = {
    onPage: {
      status: 'success',
      data: {
        issues: [{
          finding: 'The page title is missing.',
          suggestedFix: 'Add an accurate title.',
        }],
      },
    },
    robotsSitemap: {
      status: 'success',
      data: { robots: { status: 'unavailable' } },
    },
  };
  const generated = await generateSeoReport(signals, {});
  assert.deepEqual(generated, validateSeoReport(buildMockSeoReport(signals)));
  assert.equal(generated.audit_version, 'v1.0');
  assert.equal(generated.recommendations[0].priority, 'CRITICAL');
});

test('validates quick-win time bounds and exact report structure', () => {
  assert.equal(validateSeoReport(validReport()).recommendations[0].priority, 'CRITICAL');

  const tooLong = validReport();
  tooLong.quick_wins[0].effort_hours = 2.01;
  assert.throws(() => validateSeoReport(tooLong), ReportValidationError);

  const unexpectedField = validReport();
  unexpectedField.private_data = 'unexpected';
  assert.throws(() => validateSeoReport(unexpectedField), /private_data is not allowed/);
});

test('mock reports do not invent findings for unavailable signals', () => {
  const report = buildMockSeoReport({
    pageSpeed: { status: 'error', error: { message: 'not configured' } },
  });

  assert.equal(report.critical_issues.length, 0);
  assert.match(report.executive_summary, /pageSpeed/);
  assert.match(report.executive_summary, /overall score is provisional/);
});

test('available schema results contribute their measured score', () => {
  assert.equal(calculateSchemaScore({
    schema: {
      status: 'success',
      data: { totalBlocks: 4, validBlocks: 3, invalidBlocks: 1 },
    },
  }), 75);
});

test('unavailable and malformed schema data use neutral provisional scores', () => {
  const unavailable = scoreBreakdownFromSignals({
    schema: { status: 'error', error: { message: 'unavailable' } },
  });
  const malformed = scoreBreakdownFromSignals({
    schema: {
      status: 'success',
      data: { totalBlocks: 2, validBlocks: 3, invalidBlocks: -1 },
    },
  });

  assert.equal(unavailable.scores.schema, 50);
  assert.equal(malformed.scores.schema, 50);
  assert.ok(unavailable.provisionalCategories.includes('schema'));
  assert.ok(malformed.provisionalCategories.includes('schema'));
});

test('genuinely measured zero-valued schema results remain zero', () => {
  assert.equal(calculateSchemaScore({
    schema: {
      status: 'success',
      data: { totalBlocks: 2, validBlocks: 0, invalidBlocks: 2 },
    },
  }), 0);
  assert.equal(calculateSchemaScore({
    schema: {
      status: 'success',
      data: { totalBlocks: 0, validBlocks: 0, invalidBlocks: 0 },
    },
  }), 0);
});

test('overall score uses neutral values for unavailable inputs but preserves measured zero', () => {
  const completeSignals = {
    onPage: {
      status: 'success',
      data: {
        checks: {
          title: { present: true },
          metaDescription: { present: true },
          h1: { status: 'single' },
          images: { count: 0, missingAlt: 0 },
        },
      },
    },
    robotsSitemap: {
      status: 'success',
      data: {
        robots: { status: 'available' },
        sitemap: { status: 'available' },
      },
    },
    pageSpeed: {
      status: 'success',
      data: {
        audits: {
          'largest-contentful-paint': { score: 1 },
          'cumulative-layout-shift': { score: 1 },
          'interaction-to-next-paint': { score: 1 },
        },
      },
    },
  };
  const unavailable = buildMockSeoReport({
    ...completeSignals,
    schema: { status: 'error', error: { message: 'unavailable' } },
  });
  const malformed = buildMockSeoReport({
    ...completeSignals,
    schema: {
      status: 'success',
      data: { totalBlocks: 1, validBlocks: 2, invalidBlocks: -1 },
    },
  });
  const measuredZero = buildMockSeoReport({
    ...completeSignals,
    schema: {
      status: 'success',
      data: { totalBlocks: 1, validBlocks: 0, invalidBlocks: 1 },
    },
  });

  assert.equal(unavailable.overall_score, 100);
  assert.equal(malformed.overall_score, 100);
  assert.equal(measuredZero.overall_score, 75);
});

test('mock report keeps the assessment JSON shape and labels incomplete categories', () => {
  const report = buildMockSeoReport({
    schema: { status: 'error', error: { message: 'unavailable' } },
  });

  assert.deepEqual(Object.keys(report), [
    'audit_version',
    'overall_score',
    'score_breakdown',
    'critical_issues',
    'important_issues',
    'quick_wins',
    'recommendations',
    'executive_summary',
  ]);
  assert.equal(report.score_breakdown.schema, 50);
  assert.equal(report.overall_score, 50);
  assert.match(report.executive_summary, /schema/);
  assert.match(report.executive_summary, /content/);
});
