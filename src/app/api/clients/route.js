import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateClientInput } from "@/lib/management/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logFailure(operation, error) {
  console.error(`Client ${operation} failed:`, {
    name: error?.name || "Error",
    code: error?.code || "UNKNOWN",
  });
}

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { businessName: "asc" },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        createdAt: true,
        _count: { select: { websites: true } },
      },
    });
    return NextResponse.json({ data: clients });
  } catch (error) {
    logFailure("list", error);
    return NextResponse.json(
      { error: "Clients are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = validateClientInput(body);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const client = await prisma.client.create({
      data: validation.data,
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A client with those unique details already exists." },
        { status: 409 }
      );
    }
    logFailure("create", error);
    return NextResponse.json(
      { error: "Unable to create the client right now." },
      { status: 500 }
    );
  }
}
