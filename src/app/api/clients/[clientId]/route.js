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

export async function GET(request, { params }) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        websites: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            url: true,
            createdAt: true,
            _count: { select: { audits: true } },
            audits: {
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                overallScore: true,
                createdAt: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    return NextResponse.json({ data: client });
  } catch (error) {
    logFailure("read", error);
    return NextResponse.json(
      { error: "Client details are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = validateClientInput(body, { partial: true });
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const client = await prisma.client.update({
      where: { id: params.clientId },
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
    return NextResponse.json({ data: client });
  } catch (error) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    logFailure("update", error);
    return NextResponse.json(
      { error: "Unable to update the client right now." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  try {
    const { deleteClient } = require("../../../../services/record-deletion");
    const { reportStorage } = require("../../../../services/report-storage");
    const data = await deleteClient(prisma, params.clientId, { storage: reportStorage });
    return NextResponse.json({ data: { ...data, deleted: true } });
  } catch (error) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error?.code === "P2034") {
      return NextResponse.json(
        { error: "The client changed while deletion was in progress. Refresh and try again." },
        { status: 409 }
      );
    }
    logFailure("delete", error);
    return NextResponse.json(
      { error: "Unable to delete the client right now." },
      { status: 500 }
    );
  }
}
