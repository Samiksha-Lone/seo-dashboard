import DashboardShell from "@/components/layout/DashboardShell";
import StatCard from "@/components/dashboard/StatCard";
import RecentAudits from "@/components/dashboard/RecentAudits";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DashboardEmptyState from "@/components/dashboard/DashboardEmptyState";
import { getDashboardOverview } from "@/lib/dashboard/data";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Dashboard",
  description: "Review SEO performance, audit activity, and key workspace metrics.",
};

export const dynamic = "force-dynamic";

function DashboardError() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900"
    >
      <h2 className="text-base font-semibold">Dashboard data is unavailable</h2>
      <p className="mt-1 text-sm text-rose-800">
        We couldn&apos;t load the overview from the database. Check the database
        connection and try again.
      </p>
      <a
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-rose-900 ring-1 ring-rose-200 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        Try again
      </a>
    </div>
  );
}

export default async function Home() {
  await requirePageRole(["ADMIN"]);
  let overview;

  try {
    overview = await getDashboardOverview();
  } catch (error) {
    console.error("Dashboard overview query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return (
      <DashboardShell>
        <DashboardError />
      </DashboardShell>
    );
  }

  const { stats, audits } = overview;
  const hasData = stats.totalClients > 0 || stats.totalWebsites > 0 || stats.totalAudits > 0;

  return (
    <DashboardShell>
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Admin Workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Dashboard Overview
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Keep track of your clients, websites, and automated SEO audit performance.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Live workspace metrics
          </div>
        </section>

        {!hasData && <DashboardEmptyState />}

        <section aria-label="Key metrics">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total clients"
              value={stats.totalClients}
              detail="Clients in your workspace"
              icon="clients"
            />
            <StatCard
              label="Total websites"
              value={stats.totalWebsites}
              detail="Websites being monitored"
              icon="websites"
            />
            <StatCard
              label="Total audits"
              value={stats.totalAudits}
              detail="Audits across all websites"
              icon="audits"
            />
            <StatCard
              label="Average SEO score"
              value={stats.averageSeoScore == null ? "—" : `${stats.averageSeoScore}`}
              detail={
                stats.averageSeoScore == null
                  ? "No scored completed audits yet"
                  : "Across completed scored audits"
              }
              icon="score"
              suffix={stats.averageSeoScore == null ? null : "/ 100"}
            />
          </div>
        </section>

        <section aria-labelledby="audit-status-heading">
          <div className="mb-4">
            <h2 id="audit-status-heading" className="text-base font-semibold text-slate-900">
              Audit status
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Current lifecycle distribution across all audits.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Completed", status: "COMPLETED", count: stats.completedAudits },
              { label: "Pending", status: "PENDING", count: stats.pendingAudits },
              { label: "Failed", status: "FAILED", count: stats.failedAudits },
            ].map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {item.status === "PENDING" ? (
                    <div className="flex items-center gap-2">
                      <AuditStatusBadge status="QUEUED" />
                      <AuditStatusBadge status="PROCESSING" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AuditStatusBadge status={item.status} />
                      <span className="text-xs font-medium text-slate-600 sm:hidden lg:inline">{item.label}</span>
                    </div>
                  )}
                </div>
                <span className="text-2xl font-bold tabular-nums text-slate-950">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Pending includes both queued and currently processing audit jobs.
          </p>
        </section>

        <RecentAudits audits={audits} />
      </div>
    </DashboardShell>
  );
}
