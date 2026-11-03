import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import auditQueueService from '../../../services/audit-queue.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const auditStatuses = new Set(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']);

function logFailure(operation, error) {
  console.error(`Audit ${operation} failed:`, {
    name: error?.name || 'Error',
    code: error?.code || 'UNKNOWN',
  });
}

function parseBoundedInteger(value, fallback, maximum) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximum ? parsed : null;
}

export async function GET(request) {
  const { authorizeApi } = require("../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get('status');
  if (status && !auditStatuses.has(status)) {
    return NextResponse.json(
      { error: 'Status must be QUEUED, PROCESSING, COMPLETED, or FAILED.' },
      { status: 400 }
    );
  }

  const limit = parseBoundedInteger(searchParams.get('limit'), 50, 100);
  const offset = parseBoundedInteger(searchParams.get('offset'), 0, 100000);
  if (limit === null || limit < 1 || offset === null) {
    return NextResponse.json(
      { error: 'Limit must be 1–100 and offset must be a non-negative integer.' },
      { status: 400 }
    );
  }

  const where = status ? { status } : {};
  try {
    const [audits, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          overallScore: true,
          createdAt: true,
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
        },
      }),
      prisma.audit.count({ where }),
    ]);

    return NextResponse.json({ data: { audits, total, limit, offset } });
  } catch (error) {
    logFailure('list', error);
    return NextResponse.json(
      { error: 'Audits are temporarily unavailable.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const { authorizeApi } = require("../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
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
