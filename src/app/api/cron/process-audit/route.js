import { NextResponse } from 'next/server';
import { processNextAuditJob } from '../../../../services/audit-cron-worker.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const result = await processNextAuditJob({
    authorization: request.headers.get('authorization'),
  });
  return NextResponse.json(result.body, { status: result.status });
}
