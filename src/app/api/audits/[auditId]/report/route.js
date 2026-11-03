import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { getAuditReportDownload } = require('../../../../../services/report-download');
  const result = await getAuditReportDownload(params.auditId, prisma);
  if (Buffer.isBuffer(result.body)) {
    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  }
  return NextResponse.json(result.body, { status: result.status });
}
