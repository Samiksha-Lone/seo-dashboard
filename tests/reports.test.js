const test = require('node:test');
const assert = require('node:assert/strict');
const { getReportDetails, listReports } = require('../src/services/reports');

function createReportFixture() {
  return {
    id: 'report_123',
    fileName: 'seo-audit-audit_123.pdf',
    generatedAt: new Date('2026-11-03T08:30:00.000Z'),
    filePath: 'must-not-be-exposed.pdf',
    audit: {
      id: 'audit_123',
      status: 'COMPLETED',
      overallScore: 87,
      createdAt: new Date('2026-11-03T08:00:00.000Z'),
      scoreBreakdown: {
        technical: 91,
        on_page: 82,
        content: 73,
        core_web_vitals: 64,
        schema: 55,
      },
      result: { executive_summary: 'Persisted summary.' },
      website: {
        id: 'website_123',
        name: 'Example',
        url: 'https://example.test/',
        client: {
          id: 'client_123',
          businessName: 'Example Client',
          businessType: 'Retail',
          city: 'Test City',
          state: 'TS',
        },
      },
      issues: [
        {
          id: 'issue_1',
          severity: 'CRITICAL',
          category: 'Technical',
          title: 'Missing title',
          finding: 'Finding',
          fix: 'Fix',
          estimatedImpact: 'High',
          effort: 'Low',
          falsifiabilityCheck: 'Verify the title.',
        },
        {
          id: 'issue_2',
          severity: 'IMPORTANT',
          category: 'Content',
          title: 'Thin content',
          finding: 'Finding',
          fix: 'Fix',
          estimatedImpact: 'Medium',
          effort: 'Medium',
          falsifiabilityCheck: 'Review page content.',
        },
        {
          id: 'issue_3',
          severity: 'QUICK_WIN',
          category: 'Schema',
          title: 'Add schema',
          finding: 'Finding',
          fix: 'Fix',
          estimatedImpact: 'Low',
          effort: 'Low',
          falsifiabilityCheck: 'Validate structured data.',
        },
      ],
      recommendations: [
        {
          id: 'recommendation_1',
          priority: 'HIGH',
          category: 'Technical',
          finding: 'Recommendation finding',
          fix: 'Recommendation fix',
          estimatedImpact: 'High',
          effort: 'Medium',
          falsifiabilityCheck: 'Measure after deployment.',
        },
      ],
    },
  };
}

function searchParams(query = '') {
  return new URLSearchParams(query);
}

test('reports list applies search, client, date filters, newest-first order, and pagination', async () => {
  const report = createReportFixture();
  const calls = {};
  const prisma = {
    report: {
      async findMany(args) {
        calls.findMany = args;
        return [report];
      },
      async count(args) {
        calls.count = args;
        return 1;
      },
    },
    client: {
      async findMany(args) {
        calls.clients = args;
        return [{ id: 'client_123', businessName: 'Example Client' }];
      },
    },
  };

  const result = await listReports(
    prisma,
    searchParams('search=example.test&clientId=client_123&from=2026-11-01&to=2026-11-03&limit=10&offset=20')
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.reports, [{
    id: 'report_123',
    fileName: 'seo-audit-audit_123.pdf',
    generatedAt: report.generatedAt,
    audit: {
      id: 'audit_123',
      status: 'COMPLETED',
      overallScore: 87,
      website: {
        id: 'website_123',
        name: 'Example',
        url: 'https://example.test/',
        client: { id: 'client_123', businessName: 'Example Client' },
      },
    },
  }]);
  assert.equal(calls.findMany.take, 10);
  assert.equal(calls.findMany.skip, 20);
  assert.deepEqual(calls.findMany.orderBy, { generatedAt: 'desc' });
  assert.deepEqual(calls.findMany.where.AND[0], { audit: { website: { clientId: 'client_123' } } });
  assert.deepEqual(calls.findMany.where.AND[1], {
    generatedAt: {
      gte: new Date('2026-11-01T00:00:00.000Z'),
      lt: new Date('2026-11-04T00:00:00.000Z'),
    },
  });
  assert.deepEqual(calls.findMany.where.AND[2].OR, [
    { audit: { website: { client: { businessName: { contains: 'example.test', mode: 'insensitive' } } } } },
    { audit: { website: { url: { contains: 'example.test', mode: 'insensitive' } } } },
  ]);
  assert.equal(calls.count.where, calls.findMany.where);
  assert.equal(result.body.data.clients[0].id, 'client_123');
  assert.equal(JSON.stringify(result.body).includes('must-not-be-exposed.pdf'), false);
});

test('reports list accepts empty filters and returns an empty result without mock data', async () => {
  const prisma = {
    report: {
      async findMany() { return []; },
      async count() { return 0; },
    },
    client: { async findMany() { return []; } },
  };
  const result = await listReports(prisma, searchParams());
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.reports, []);
  assert.equal(result.body.data.total, 0);
  assert.equal(result.body.data.limit, 20);
  assert.equal(result.body.data.offset, 0);
});

test('reports list rejects invalid pagination, IDs, dates, and date ranges before querying', async () => {
  let queried = false;
  const prisma = {
    report: {
      async findMany() { queried = true; },
      async count() { queried = true; },
    },
    client: { async findMany() { queried = true; } },
  };
  for (const query of [
    'limit=0',
    'offset=-1',
    'clientId=../secret',
    'from=2026-02-30',
    'from=2026-11-05&to=2026-11-03',
    `search=${'x'.repeat(201)}`,
  ]) {
    const result = await listReports(prisma, searchParams(query));
    assert.equal(result.status, 400, query);
    assert.equal(typeof result.body.error, 'string');
  }
  assert.equal(queried, false);
});

test('report details return the selected report with its persisted audit relationships and findings', async () => {
  const report = createReportFixture();
  let requestedId;
  const result = await getReportDetails('report_123', {
    report: {
      async findFirst(args) {
        requestedId = args.where.id;
        return report;
      },
    },
  });

  assert.equal(requestedId, 'report_123');
  assert.equal(result.status, 200);
  assert.equal(result.body.data.audit.id, 'audit_123');
  assert.equal(result.body.data.audit.website.client.businessName, 'Example Client');
  assert.equal(result.body.data.audit.overallScore, 87);
  assert.equal(result.body.data.audit.executiveSummary, 'Persisted summary.');
  assert.deepEqual(result.body.data.audit.scoreBreakdown, {
    technical: 91,
    onPage: 82,
    content: 73,
    coreWebVitals: 64,
    schema: 55,
  });
  assert.deepEqual(result.body.data.audit.issues.critical.map(({ id }) => id), ['issue_1']);
  assert.deepEqual(result.body.data.audit.issues.important.map(({ id }) => id), ['issue_2']);
  assert.deepEqual(result.body.data.audit.issues.quickWins.map(({ id }) => id), ['issue_3']);
  assert.deepEqual(result.body.data.audit.recommendations.map(({ priority }) => priority), ['HIGH']);
  assert.equal(result.body.data.downloadUrl, '/api/audits/audit_123/report');
  assert.equal(JSON.stringify(result.body).includes('filePath'), false);
});

test('report details reject invalid IDs and return 404 for missing reports', async () => {
  let queried = false;
  const prisma = { report: { async findFirst() { queried = true; return null; } } };
  const invalid = await getReportDetails('../private.pdf', prisma);
  assert.equal(invalid.status, 400);
  assert.equal(queried, false);

  const missing = await getReportDetails('report_missing', prisma);
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: 'Report not found.' });
  assert.equal(queried, true);
});

test('client report lookup includes an ownership constraint and hides other clients reports', async () => {
  const report = createReportFixture();
  let where;
  const prisma = {
    report: {
      async findFirst(args) {
        where = args.where;
        if (args.where.audit.website.clientId !== 'client_123') return null;
        return report;
      },
    },
  };
  const ownReport = await getReportDetails('report_123', prisma, 'client_123');
  assert.equal(ownReport.status, 200);
  assert.deepEqual(where, {
    id: 'report_123',
    audit: { website: { clientId: 'client_123' } },
  });
  const otherClient = await getReportDetails('report_123', prisma, 'client_b');
  assert.equal(otherClient.status, 404);
});
