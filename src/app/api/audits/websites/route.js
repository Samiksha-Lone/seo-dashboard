import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  try {
    const websites = await prisma.website.findMany({
      orderBy: [{ client: { businessName: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        url: true,
        clientId: true,
        client: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
    });
    return NextResponse.json({ data: websites });
  } catch (error) {
    console.error('Audit website selector query failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return NextResponse.json(
      { error: 'Registered websites are temporarily unavailable.' },
      { status: 500 }
    );
  }
}
