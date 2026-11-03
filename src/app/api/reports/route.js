import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { authorizeApi } = require('../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['ADMIN'] });
  if (auth.response) return auth.response;
  const { listReports } = require('../../../services/reports');
  const result = await listReports(prisma, new URL(request.url).searchParams);
  return NextResponse.json(result.body, { status: result.status });
}
