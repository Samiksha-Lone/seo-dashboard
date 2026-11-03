import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { handleMonthlyAuditRequest } = require('../../../../services/monthly-audits');
  const result = await handleMonthlyAuditRequest({
    authorization: request.headers.get('authorization'),
    prisma,
  });
  return NextResponse.json(result.body, { status: result.status });
}
