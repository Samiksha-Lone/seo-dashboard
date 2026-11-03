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

export async function GET(request) {
  const { authorizeApi } = require("../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
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
        user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
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
  const { authorizeApi } = require("../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { account, ...clientBody } = body || {};
  const validation = validateClientInput(clientBody);
  if (validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let accountData = null;
  if (account !== undefined) {
    const { hashPassword, validateEmail, validatePassword } = require("../../../services/auth");
    if (!account || typeof account !== "object" || Array.isArray(account) ||
        Object.keys(account).some((key) => !["email", "temporaryPassword"].includes(key))) {
      return NextResponse.json({ error: "Account must contain an email and temporaryPassword." }, { status: 400 });
    }
    const email = validateEmail(account.email);
    if (!email) return NextResponse.json({ error: "Enter a valid client account email." }, { status: 400 });
    const passwordError = validatePassword(account.temporaryPassword, { temporary: true });
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
    accountData = { email, temporaryPassword: account.temporaryPassword, hashPassword };
  }

  try {
    const client = await prisma.client.create({
      data: {
        ...validation.data,
        ...(accountData
          ? {
              user: {
                create: {
                  name: validation.data.businessName,
                  email: accountData.email,
                  passwordHash: await accountData.hashPassword(accountData.temporaryPassword),
                  role: "CLIENT",
                  mustChangePassword: true,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
      },
    });
    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "A client or account with those unique details already exists." },
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
