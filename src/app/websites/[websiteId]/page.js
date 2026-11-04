import Link from "next/link";
import { notFound } from "next/navigation";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DashboardShell from "@/components/layout/DashboardShell";
import DeleteRecordButton from "@/components/management/DeleteRecordButton";
import WebsiteDialogButton from "@/components/management/WebsiteDialogButton";
import ManagementError from "@/components/management/ManagementError";
import { formatManagementDate } from "@/lib/management/format";
import { prisma } from "@/lib/prisma";
import { runDatabaseOperation } from "@/lib/prisma-diagnostics";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Website Details",
  description: "Review website information, its client, and audit history.",
};

export const dynamic = "force-dynamic";

export default async function WebsiteDetailPage({ params }) {
  await requirePageRole(["ADMIN"]);
  let website;
  let clients;
  try {
    [website, clients] = await Promise.all([
      runDatabaseOperation("websiteDetail.website.findUnique", () =>
        prisma.website.findUnique({
          where: { id: params.websiteId },
          select: {
            id: true,
            name: true,
            url: true,
            clientId: true,
            createdAt: true,
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
                report: { select: { id: true } },
              },
            },
            _count: { select: { audits: true } },
          },
        })
      ),
      runDatabaseOperation("websiteDetail.client.findMany", () =>
        prisma.client.findMany({
          orderBy: { businessName: "asc" },
          select: { id: true, businessName: true, city: true, state: true },
        })
      ),
    ]);
  } catch (error) {
    console.error("Website detail query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Website" /></DashboardShell>;
  }
  if (!website) notFound();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/websites"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:underline"
          >
            <span aria-hidden="true">←</span> Back to Websites
          </Link>
          <section className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Domain details</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {website.name}
              </h1>
              <a
                href={website.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 break-all text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {website.url}
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/audits/new"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                Run audit
              </Link>
              <WebsiteDialogButton website={website} clients={clients} label="Edit website" variant="secondary" />
              <DeleteRecordButton resource="websites" recordId={website.id} label={website.name} listHref="/websites" />
            </div>
          </section>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Associated Client</p>
            <Link
              href={`/clients/${website.client.id}`}
              className="mt-2 inline-block text-sm font-bold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline"
            >
              {website.client.businessName}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">{website.client.city}, {website.client.state}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Business Industry</p>
            <p className="mt-2 text-sm font-bold text-slate-900">{website.client.businessType}</p>
            <p className="mt-0.5 text-xs text-slate-500">Registered {formatManagementDate(website.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Audits</p>
            <p className="mt-2 text-sm font-bold text-slate-900 tabular-nums">
              {website._count.audits} audit{website._count.audits === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Historical audit count</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Audit history</h2>
              <p className="mt-0.5 text-xs text-slate-500">Audit records captured for this website.</p>
            </div>
            <Link
              href="/audits/new"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              + Queue new audit
            </Link>
          </div>
          {website.audits.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No audits have been recorded for this website yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {website.audits.map((audit) => (
                <div key={audit.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 hover:bg-slate-50/60 transition">
                  <div>
                    <Link
                      href={`/audits/${audit.id}`}
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600"
                    >
                      Audit on {formatManagementDate(audit.createdAt)}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {audit.completedAt ? `Completed ${formatManagementDate(audit.completedAt)}` : "In progress / Pending"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold tabular-nums text-slate-900">
                      {audit.overallScore == null ? "—" : `${audit.overallScore} / 100`}
                    </span>
                    <AuditStatusBadge status={audit.status} />
                    <Link
                      href={`/audits/${audit.id}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      View audit →
                    </Link>
                    {audit.report && (
                      <Link
                        href={`/reports/${audit.report.id}`}
                        className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        PDF
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
