import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isValidId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);

export async function GET(request, { params }) {
  const { authorizeApi } = require('../../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['CLIENT'] });
  if (auth.response) return auth.response;
  if (!isValidId(params.auditId)) return NextResponse.json({ error: 'Invalid audit ID.' }, { status: 400 });

  try {
    const audit = await prisma.audit.findFirst({
      where: { id: params.auditId, website: { clientId: auth.session.user.clientId } },
      select: {
        id: true,
        status: true,
        overallScore: true,
        scoreBreakdown: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        completedAt: true,
        website: {
          select: {
            id: true,
            name: true,
            url: true,
            client: { select: { id: true, businessName: true } },
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
        report: { select: { id: true, fileName: true, generatedAt: true } },
      },
    });
    if (!audit) return NextResponse.json({ error: 'Audit not found.' }, { status: 404 });
    const persistedBreakdown = audit.scoreBreakdown;
    const scoreBreakdown = persistedBreakdown && typeof persistedBreakdown === 'object'
      ? {
          technical: persistedBreakdown.technical ?? null,
          onPage: persistedBreakdown.on_page ?? null,
          content: persistedBreakdown.content ?? null,
          coreWebVitals: persistedBreakdown.core_web_vitals ?? null,
          schema: persistedBreakdown.schema ?? null,
        }
      : null;
    return NextResponse.json({
      data: {
        ...audit,
        scoreBreakdown,
        report: audit.report
          ? {
              ...audit.report,
              downloadUrl: `/api/audits/${encodeURIComponent(audit.id)}/report`,
              detailsUrl: `/portal/reports/${encodeURIComponent(audit.report.id)}`,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Client portal audit query failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Audit details are temporarily unavailable.' }, { status: 500 });
  }
}
