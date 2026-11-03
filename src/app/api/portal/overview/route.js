import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { authorizeApi } = require('../../../../services/auth');
  const auth = await authorizeApi(request, prisma, { roles: ['CLIENT'] });
  if (auth.response) return auth.response;

  try {
    const client = await prisma.client.findUnique({
      where: { id: auth.session.user.clientId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        websites: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            url: true,
            audits: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                overallScore: true,
                createdAt: true,
                completedAt: true,
                report: { select: { id: true, fileName: true, generatedAt: true } },
              },
            },
          },
        },
      },
    });
    if (!client) return NextResponse.json({ error: 'Client profile not found.' }, { status: 404 });
    return NextResponse.json({ data: client });
  } catch (error) {
    console.error('Client portal overview query failed:', {
      name: error && error.name ? error.name : 'Error',
      code: error && error.code ? error.code : 'UNKNOWN',
    });
    return NextResponse.json({ error: 'Your portal data is temporarily unavailable.' }, { status: 500 });
  }
}
