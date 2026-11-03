import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { authorizeApi } = require('../../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['ADMIN', 'CLIENT'] });
  if (auth.response) return auth.response;
  const { getAuditReportDownload } = require('../../../../../services/report-download');
  const { reportStorage } = require('../../../../../services/report-storage');
  const result = await getAuditReportDownload(
    params.auditId,
    prisma,
    reportStorage,
    { user: auth.session.user }
  );
  if (result.headers && result.headers.Location) {
    return NextResponse.redirect(result.headers.Location, {
      status: result.status,
      headers: result.headers,
    });
  }
  if (Buffer.isBuffer(result.body)) {
    return new NextResponse(result.body, {
      status: result.status,
      headers: result.headers,
    });
  }
  return NextResponse.json(result.body, { status: result.status });
}
