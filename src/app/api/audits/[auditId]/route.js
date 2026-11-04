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
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(_request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
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
            id: true,
            fileName: true,
            filePath: true,
            generatedAt: true,
            notificationAttemptedAt: true,
          },
        },
      },
    });

    if (!audit) {
      return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });
    }

    const report = audit.report
      ? {
          id: audit.report.id,
          fileName: audit.report.fileName,
          generatedAt: audit.report.generatedAt,
          notificationAttemptedAt: audit.report.notificationAttemptedAt,
          storage: require('../../../../services/report-storage')
            .getReportStorageType(audit.report.filePath),
          downloadUrl: `/api/audits/${encodeURIComponent(audit.id)}/report`,
        }
      : null;

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
        report,
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

export async function DELETE(request, { params }) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  if (!isValidId(params.auditId)) {
    return NextResponse.json({ error: 'Invalid audit ID.' }, { status: 400 });
  }

  try {
    const { deleteAudit } = require("../../../../services/record-deletion");
    const { reportStorage } = require("../../../../services/report-storage");
    const data = await deleteAudit(prisma, params.auditId, { storage: reportStorage });
    return NextResponse.json({ data: { ...data, deleted: true } });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error?.code === 'P2034') {
      return NextResponse.json(
        { error: 'The audit changed while deletion was in progress. Refresh and try again.' },
        { status: 409 },
      );
    }
    console.error('Audit deletion failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Unable to delete the audit right now.' },
      { status: 500 },
    );
  }
}
