import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scoreCategories = [
  ['technical', 'technical'],
  ['onPage', 'on_page'],
  ['content', 'content'],
  ['coreWebVitals', 'core_web_vitals'],
  ['schema', 'schema'],
];

function isValidId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}

function scoreBreakdown(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(
    scoreCategories.map(([key, source]) => [
      key,
      Number.isInteger(value[source]) && value[source] >= 0 && value[source] <= 100
        ? value[source]
        : null,
    ])
  );
}

function executiveSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const summary = value.executive_summary;
  return typeof summary === 'string' && summary.trim() ? summary : null;
}

export async function GET(_request, { params }) {
  if (!isValidId(params.auditId)) {
    return NextResponse.json({ error: 'Invalid audit ID.' }, { status: 400 });
  }

  try {
    const audit = await prisma.audit.findUnique({
      where: { id: params.auditId },
      select: {
        id: true,
        status: true,
        overallScore: true,
        scoreBreakdown: true,
        result: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        website: {
          select: {
            id: true,
            name: true,
            url: true,
            client: {
              select: { id: true, businessName: true },
            },
          },
        },
        issues: {
          orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }],
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
        report: {
          select: {
            fileName: true,
            generatedAt: true,
            notificationAttemptedAt: true,
          },
        },
      },
    });

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: audit.id,
        status: audit.status,
        overallScore: audit.overallScore,
        scoreBreakdown: scoreBreakdown(audit.scoreBreakdown),
        executiveSummary: executiveSummary(audit.result),
        createdAt: audit.createdAt,
        updatedAt: audit.updatedAt,
        startedAt: audit.startedAt,
        completedAt: audit.completedAt,
        website: audit.website,
        issues: audit.issues,
        recommendations: audit.recommendations,
        report: audit.report
          ? {
              ...audit.report,
              storage: 'local',
              downloadUrl: `/api/audits/${encodeURIComponent(audit.id)}/report`,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Audit detail query failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Audit details are temporarily unavailable.' },
      { status: 500 }
    );
  }
}
