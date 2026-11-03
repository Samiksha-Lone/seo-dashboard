import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const { authorizeApi } = require('../../../../services/auth');
  const auth = await authorizeApi(_request, prisma, { roles: ['ADMIN'] });
  if (auth.response) return auth.response;
  const { getReportDetails } = require('../../../../services/reports');
  const result = await getReportDetails(params.reportId, prisma);
  return NextResponse.json(result.body, { status: result.status });
}
