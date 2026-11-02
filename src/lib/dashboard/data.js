import { prisma } from "@/lib/prisma";

function countForStatus(groups, status) {
  return groups.find((group) => group.status === status)?._count._all ?? 0;
}

export async function getDashboardStats() {
  const [totalClients, totalWebsites, totalAudits, auditsByStatus, scoreAggregate] =
    await Promise.all([
      prisma.client.count(),
      prisma.website.count(),
      prisma.audit.count(),
      prisma.audit.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.audit.aggregate({
        where: {
          status: "COMPLETED",
          overallScore: { not: null },
        },
        _avg: { overallScore: true },
      }),
    ]);

  const average = scoreAggregate._avg.overallScore;

  return {
    totalClients,
    totalWebsites,
    totalAudits,
    completedAudits: countForStatus(auditsByStatus, "COMPLETED"),
    pendingAudits:
      countForStatus(auditsByStatus, "QUEUED") +
      countForStatus(auditsByStatus, "PROCESSING"),
    failedAudits: countForStatus(auditsByStatus, "FAILED"),
    averageSeoScore: average == null ? null : Number(average.toFixed(1)),
  };
}

export async function getRecentAudits() {
  const audits = await prisma.audit.findMany({
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
  });

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
