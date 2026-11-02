import { NextResponse } from 'next/server';
import auditQueueService from '../../../services/audit-queue.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Request body must contain url and clientId.' },
      { status: 400 }
    );
  }

  try {
    const result = await auditQueueService.enqueueAudit({
      url: body.url,
      clientId: body.clientId,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const message = status < 500
      ? error.message
      : 'Unable to enqueue audit. Please try again later.';

    return NextResponse.json(
      { error: message, code: error.code || 'AUDIT_ENQUEUE_FAILED' },
      { status }
    );
  }
}
