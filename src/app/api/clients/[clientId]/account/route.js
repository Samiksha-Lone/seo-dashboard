import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function logFailure(operation, error) {
  console.error(`Client account ${operation} failed:`, {
    name: error && error.name ? error.name : 'Error',
    code: error && error.code ? error.code : 'UNKNOWN',
  });
}

function sendResult(result) {
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request, { params }) {
  const { authorizeApi } = require('../../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['ADMIN'] });
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['action', 'email', 'temporaryPassword'].includes(key)) ||
      !['provision', 'resetPassword'].includes(body.action)) {
    return NextResponse.json({ error: 'Choose provision or resetPassword and provide account details.' }, { status: 400 });
  }

  try {
    const { updateClientAccount } = require('../../../../../services/client-accounts');
    return sendResult(await updateClientAccount(prisma, params.clientId, body));
  } catch (error) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'That email address is already assigned to an account.' }, { status: 409 });
    }
    logFailure(body.action, error);
    return NextResponse.json({ error: 'Unable to update the client account right now.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { authorizeApi } = require('../../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['ADMIN'] });
  if (auth.response) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((key) => !['email', 'isActive'].includes(key)) ||
      (!Object.hasOwn(body, 'email') && !Object.hasOwn(body, 'isActive'))) {
    return NextResponse.json({ error: 'Provide an email or account active state.' }, { status: 400 });
  }

  try {
    const { updateClientAccount } = require('../../../../../services/client-accounts');
    return sendResult(await updateClientAccount(prisma, params.clientId, body));
  } catch (error) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'That email address is already assigned to an account.' }, { status: 409 });
    }
    logFailure('update', error);
    return NextResponse.json({ error: 'Unable to update the client account right now.' }, { status: 500 });
  }
}
