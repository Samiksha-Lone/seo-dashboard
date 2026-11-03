import { NextResponse } from "next/server";
import { getRecentAudits } from "@/lib/dashboard/data";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  try {
    const audits = await getRecentAudits();
    return NextResponse.json({ data: { audits } });
  } catch (error) {
    console.error("Recent audits query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return NextResponse.json(
      { error: "Recent audits are temporarily unavailable." },
      { status: 500 }
    );
  }
}
