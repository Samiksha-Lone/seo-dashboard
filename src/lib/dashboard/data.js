import { prisma } from "@/lib/prisma";
import { runDatabaseOperation } from "@/lib/prisma-diagnostics";
import { getAuditLifecycleTotals } from "./audit-lifecycle.mjs";

export async function getDashboardStats() {
  const [totalClients, totalWebsites, totalAudits, auditsByStatus, scoreAggregate] =
    await Promise.all([
      runDatabaseOperation("dashboard.stats.client.count", () =>
        prisma.client.count()
      ),
      runDatabaseOperation("dashboard.stats.website.count", () =>
        prisma.website.count()
      ),
      runDatabaseOperation("dashboard.stats.audit.count", () =>
        prisma.audit.count()
      ),
      runDatabaseOperation("dashboard.stats.audit.groupByStatus", () =>
        prisma.audit.groupBy({
          by: ["status"],
          _count: { _all: true },
        })
      ),
      runDatabaseOperation("dashboard.stats.audit.averageScore", () =>
        prisma.audit.aggregate({
          where: {
            status: "COMPLETED",
            overallScore: { not: null },
          },
          _avg: { overallScore: true },
        })
      ),
    ]);

  const lifecycleTotals = getAuditLifecycleTotals(auditsByStatus);
  const average = scoreAggregate._avg.overallScore;

  return {
    totalClients,
    totalWebsites,
    totalAudits,
    completedAudits: lifecycleTotals.completed,
    pendingAudits: lifecycleTotals.pending,
    failedAudits: lifecycleTotals.failed,
    averageSeoScore: average == null ? null : Number(average.toFixed(1)),
  };
}

export async function getRecentAudits() {
  const audits = await runDatabaseOperation("dashboard.recentAudits.findMany", () =>
    prisma.audit.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        overallScore: true,
        createdAt: true,
        completedAt: true,
        website: {
          select: {
            name: true,
            url: true,
            client: {
              select: { businessName: true },
            },
          },
        },
      },
    })
  );

  return audits.map((audit) => ({
    id: audit.id,
    status: audit.status,
    score: audit.overallScore,
    createdAt: audit.createdAt,
    completedAt: audit.completedAt,
    website: audit.website
      ? {
          name: audit.website.name,
          url: audit.website.url,
        }
      : null,
    client: audit.website?.client
      ? { name: audit.website.client.businessName }
      : null,
  }));
}

export async function getDashboardOverview() {
  const [stats, audits] = await Promise.all([
    getDashboardStats(),
    getRecentAudits(),
  ]);
  return { stats, audits };
}
