import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { authorizeApi } = require('../../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['CLIENT'] });
  if (auth.response) return auth.response;
  const { getReportDetails } = require('../../../../../services/reports');
  const result = await getReportDetails(params.reportId, prisma, auth.session.user.clientId);
  return NextResponse.json(result.body, { status: result.status });
}
