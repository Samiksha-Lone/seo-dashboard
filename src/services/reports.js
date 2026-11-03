const REPORT_ID_PATTERN = /^[a-zA-Z0-9_-]{1,200}$/;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100000;
const MAX_SEARCH_LENGTH = 200;

function isValidReportId(value) {
  return typeof value === 'string' && REPORT_ID_PATTERN.test(value);
}

function parseInteger(value, fallback, maximum) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

function parseDate(value, endOfDay = false) {
  if (value === null) return { valid: true, date: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { valid: false };
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { valid: false };
  }
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return { valid: true, date };
}

function errorResponse(status, message) {
  return { status, body: { error: message } };
}

function mapScoreBreakdown(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const categories = [
    ['technical', 'technical'],
    ['onPage', 'on_page'],
    ['content', 'content'],
    ['coreWebVitals', 'core_web_vitals'],
    ['schema', 'schema'],
  ];
  const scores = Object.fromEntries(
    categories.map(([key, source]) => [
      key,
      Number.isInteger(value[source]) && value[source] >= 0 && value[source] <= 100
        ? value[source]
        : null,
    ])
  );
  return Object.values(scores).some((score) => score !== null) ? scores : null;
}

function buildReportWhere({ search, clientId, fromDate, toDate }) {
  const conditions = [];
  if (clientId) conditions.push({ audit: { website: { clientId } } });
  if (fromDate || toDate) {
    conditions.push({
      generatedAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lt: toDate } : {}),
      },
    });
  }
  if (search) {
    conditions.push({
      OR: [
        {
          audit: {
            website: {
              client: { businessName: { contains: search, mode: 'insensitive' } },
            },
          },
        },
        { audit: { website: { url: { contains: search, mode: 'insensitive' } } } },
      ],
    });
  }
  return conditions.length ? { AND: conditions } : {};
}

function mapReportSummary(report) {
  return {
    id: report.id,
    fileName: report.fileName,
    generatedAt: report.generatedAt,
    audit: {
      id: report.audit.id,
      status: report.audit.status,
      overallScore: report.audit.overallScore,
      website: {
        id: report.audit.website.id,
        name: report.audit.website.name,
        url: report.audit.website.url,
        client: {
          id: report.audit.website.client.id,
          businessName: report.audit.website.client.businessName,
        },
      },
    },
  };
}

async function listReports(prisma, searchParams) {
  const search = (searchParams.get('search') || '').trim();
  const clientId = searchParams.get('clientId');
  const fromValue = searchParams.get('from');
  const toValue = searchParams.get('to');
  const limit = parseInteger(searchParams.get('limit'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = parseInteger(searchParams.get('offset'), 0, MAX_OFFSET);
  const from = parseDate(fromValue);
  const to = parseDate(toValue, true);

  if (search.length > MAX_SEARCH_LENGTH) {
    return errorResponse(400, `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`);
  }
  if (clientId !== null && !isValidReportId(clientId)) {
    return errorResponse(400, 'Client ID is invalid.');
  }
  if (limit === null || limit < 1 || offset === null) {
    return errorResponse(400, 'Limit must be 1–100 and offset must be a non-negative integer.');
  }
  if (!from.valid || !to.valid) {
    return errorResponse(400, 'Dates must be valid calendar dates in YYYY-MM-DD format.');
  }
  if (from.date && to.date && from.date >= to.date) {
    return errorResponse(400, 'The start date must not be later than the end date.');
  }

  const where = buildReportWhere({
    search,
    clientId,
    fromDate: from.date,
    toDate: to.date,
  });

  try {
    const [reports, total, clients] = await Promise.all([
      prisma.report.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          generatedAt: true,
          audit: {
            select: {
              id: true,
              status: true,
              overallScore: true,
              website: {
                select: {
                  id: true,
                  name: true,
                  url: true,
                  client: { select: { id: true, businessName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.report.count({ where }),
      prisma.client.findMany({
        where: {
          websites: {
            some: {
              audits: { some: { report: { isNot: null } } },
            },
          },
        },
        orderBy: { businessName: 'asc' },
        select: { id: true, businessName: true },
      }),
    ]);

    return {
      status: 200,
      body: {
        data: {
          reports: reports.map(mapReportSummary),
          clients,
          total,
          limit,
          offset,
        },
      },
    };
  } catch (error) {
    console.error('Report list query failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return errorResponse(500, 'Reports are temporarily unavailable.');
  }
}

async function getReportDetails(reportId, prisma, clientId = null) {
  if (!isValidReportId(reportId)) return errorResponse(400, 'Invalid report ID.');

  try {
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        ...(clientId ? { audit: { website: { clientId } } } : {}),
      },
      select: {
        id: true,
        fileName: true,
        generatedAt: true,
        audit: {
          select: {
            id: true,
            status: true,
            overallScore: true,
            scoreBreakdown: true,
            createdAt: true,
            result: true,
            website: {
              select: {
                id: true,
                name: true,
                url: true,
                client: {
                  select: {
                    id: true,
                    businessName: true,
                    businessType: true,
                    city: true,
                    state: true,
                  },
                },
              },
            },
            issues: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                severity: true,
                category: true,
                title: true,
                finding: true,
                fix: true,
                estimatedImpact: true,
                effort: true,
                falsifiabilityCheck: true,
              },
            },
            recommendations: {
              orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
              select: {
                id: true,
                priority: true,
                category: true,
                finding: true,
                fix: true,
                estimatedImpact: true,
                effort: true,
                falsifiabilityCheck: true,
              },
            },
          },
        },
      },
    });

    if (!report || !report.audit || !report.audit.website) {
      return errorResponse(404, 'Report not found.');
    }

    const { result, issues, recommendations, ...audit } = report.audit;
    return {
      status: 200,
      body: {
        data: {
          id: report.id,
          fileName: report.fileName,
          generatedAt: report.generatedAt,
          audit: {
            ...audit,
            executiveSummary:
              result && typeof result.executive_summary === 'string'
                ? result.executive_summary
                : null,
            scoreBreakdown: mapScoreBreakdown(
              audit.scoreBreakdown || (result && result.score_breakdown)
            ),
            issues: {
              critical: issues.filter((issue) => issue.severity === 'CRITICAL'),
              important: issues.filter((issue) => issue.severity === 'IMPORTANT'),
              quickWins: issues.filter((issue) => issue.severity === 'QUICK_WIN'),
            },
            recommendations,
          },
          downloadUrl: `/api/audits/${encodeURIComponent(audit.id)}/report`,
        },
      },
    };
  } catch (error) {
    console.error('Report detail query failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return errorResponse(500, 'Report details are temporarily unavailable.');
  }
}

module.exports = {
  buildReportWhere,
  getReportDetails,
  isValidReportId,
  listReports,
};
