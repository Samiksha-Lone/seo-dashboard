import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { authorizeApi } = require('../../../../services/auth');
  const result = await authorizeApi(request, prisma, { allowPasswordChange: true });
  if (result.response) return result.response;
  return NextResponse.json({ data: { user: result.session.user } });
}
