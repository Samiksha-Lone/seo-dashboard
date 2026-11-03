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

export async function GET(_request, { params }) {
  try {
    const website = await prisma.website.findUnique({
      where: { id: params.websiteId },
      select: {
        id: true,
        name: true,
        url: true,
        clientId: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            city: true,
            state: true,
            phone: true,
          },
        },
        audits: {
          take: 25,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            overallScore: true,
            createdAt: true,
            completedAt: true,
          },
        },
        _count: { select: { audits: true } },
      },
    });
    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }
    return NextResponse.json({ data: website });
  } catch (error) {
    logFailure("read", error);
    return NextResponse.json(
      { error: "Website details are temporarily unavailable." },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const validation = validateWebsiteInput(body, { partial: true });
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const website = await prisma.$transaction(async (transaction) => {
      const current = await transaction.website.findUnique({
        where: { id: params.websiteId },
        select: { id: true, url: true },
      });
      if (!current) {
        const error = new Error("Website not found.");
        error.statusCode = 404;
        throw error;
      }

      if (validation.data.clientId) {
        const client = await transaction.client.findUnique({
          where: { id: validation.data.clientId },
          select: { id: true },
        });
        if (!client) {
          const error = new Error("Selected client not found.");
          error.statusCode = 400;
          throw error;
        }
      }

      if (validation.data.url) {
        const duplicateKey = validation.data.duplicateKey;
        const existingWebsites = await transaction.website.findMany({
          where: { id: { not: params.websiteId } },
          select: { url: true },
        });
        if (existingWebsites.some(
          (existing) => websiteUrlDuplicateKey(existing.url) === duplicateKey
        )) {
          const error = new Error("A website with this URL is already registered.");
          error.statusCode = 409;
          throw error;
        }
      }

      const data = { ...validation.data };
      delete data.duplicateKey;
      return transaction.website.update({
        where: { id: params.websiteId },
        data,
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

    return NextResponse.json({ data: website });
  } catch (error) {
    if (error?.statusCode === 400 || error?.statusCode === 404 || error?.statusCode === 409) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error?.code === "P2034") {
      return NextResponse.json(
        { error: "A conflicting website update occurred. Check the URL and try again." },
        { status: 409 }
      );
    }
    if (error?.code === "P2003") {
      return NextResponse.json({ error: "Selected client does not exist." }, { status: 400 });
    }
    logFailure("update", error);
    return NextResponse.json(
      { error: "Unable to update the website right now." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const result = await prisma.website.deleteMany({
      where: {
        id: params.websiteId,
        audits: { none: {} },
      },
    });
    if (result.count === 1) {
      return NextResponse.json({ data: { id: params.websiteId, deleted: true } });
    }

    const website = await prisma.website.findUnique({
      where: { id: params.websiteId },
      select: { id: true },
    });
    if (!website) {
      return NextResponse.json({ error: "Website not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "This website has audit history and cannot be deleted." },
      { status: 409 }
    );
  } catch (error) {
    logFailure("delete", error);
    return NextResponse.json(
      { error: "Unable to delete the website right now." },
      { status: 500 }
    );
  }
}
