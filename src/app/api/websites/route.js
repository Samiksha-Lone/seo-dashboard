import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateWebsiteInput,
  websiteUrlDuplicateKey,
} from "@/lib/management/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logFailure(operation, error) {
  console.error(`Website ${operation} failed:`, {
    name: error?.name || "Error",
    code: error?.code || "UNKNOWN",
  });
}

function isConflict(error) {
  return error?.code === "P2034";
}

export async function GET() {
  try {
    const websites = await prisma.website.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        url: true,
        clientId: true,
        createdAt: true,
        client: {
          select: { id: true, businessName: true, city: true, state: true },
        },
        _count: { select: { audits: true } },
        audits: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, overallScore: true, createdAt: true },
        },
      },
    });
    return NextResponse.json({ data: websites });
  } catch (error) {
    logFailure("list", error);
    return NextResponse.json(
      { error: "Websites are temporarily unavailable." },
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

  const validation = validateWebsiteInput(body);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const website = await prisma.$transaction(async (transaction) => {
      const client = await transaction.client.findUnique({
        where: { id: validation.data.clientId },
        select: { id: true },
      });
      if (!client) {
        const error = new Error("Selected client not found.");
        error.statusCode = 400;
        throw error;
      }

      const existingWebsites = await transaction.website.findMany({
        select: { url: true },
      });
      if (existingWebsites.some(
        (existing) => websiteUrlDuplicateKey(existing.url) === validation.data.duplicateKey
      )) {
        const error = new Error("A website with this URL is already registered.");
        error.statusCode = 409;
        throw error;
      }

      return transaction.website.create({
        data: {
          name: validation.data.name,
          url: validation.data.url,
          clientId: validation.data.clientId,
        },
        select: {
          id: true,
          name: true,
          url: true,
          clientId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ data: website }, { status: 201 });
  } catch (error) {
    if (error?.statusCode === 400 || error?.statusCode === 409) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (isConflict(error)) {
      return NextResponse.json(
        { error: "A conflicting website registration occurred. Check the URL and try again." },
        { status: 409 }
      );
    }
    if (error?.code === "P2003") {
      return NextResponse.json({ error: "Selected client does not exist." }, { status: 400 });
    }
    logFailure("create", error);
    return NextResponse.json(
      { error: "Unable to create the website right now." },
      { status: 500 }
    );
  }
}
