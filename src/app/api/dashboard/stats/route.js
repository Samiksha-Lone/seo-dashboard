import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/dashboard/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
