import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/dashboard/data";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { authorizeApi } = require("../../../../services/auth");
  const auth = await authorizeApi(request, prisma, { roles: ["ADMIN"] });
  if (auth.response) return auth.response;
  try {
    const data = await getDashboardStats();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Dashboard stats query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return NextResponse.json(
      { error: "Dashboard statistics are temporarily unavailable." },
      { status: 500 }
    );
  }
}
