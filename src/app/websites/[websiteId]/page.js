import Link from "next/link";
import { notFound } from "next/navigation";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DashboardShell from "@/components/layout/DashboardShell";
import DeleteRecordButton from "@/components/management/DeleteRecordButton";
import WebsiteDialogButton from "@/components/management/WebsiteDialogButton";
import ManagementError from "@/components/management/ManagementError";
import { formatManagementDate } from "@/lib/management/format";
import { prisma } from "@/lib/prisma";
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
          },
        },
        _count: { select: { audits: true } },
      },
      }),
      prisma.client.findMany({
        orderBy: { businessName: "asc" },
        select: { id: true, businessName: true, city: true, state: true },
      }),
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
          <Link href="/websites" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Websites</Link>
          <section className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">Website details</p>
              <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{website.name}</h1>
              <a href={website.url} target="_blank" rel="noreferrer" className="mt-2 inline-block break-all text-sm text-indigo-700 hover:text-indigo-900">{website.url}</a>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <WebsiteDialogButton website={website} clients={clients} label="Edit website" variant="secondary" />
              <DeleteRecordButton resource="websites" recordId={website.id} label={website.name} listHref="/websites" />
            </div>
          </section>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Client</p>
            <Link href={`/clients/${website.client.id}`} className="mt-2 inline-block text-sm font-semibold text-indigo-700 hover:text-indigo-900">{website.client.businessName}</Link>
            <p className="mt-1 text-sm text-slate-500">{website.client.city}, {website.client.state}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Business type</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{website.client.businessType}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Audit history</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{website._count.audits} audit{website._count.audits === 1 ? "" : "s"}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-slate-900">Audit history</h2>
            <p className="mt-1 text-sm text-slate-500">Most recent audit records for this website.</p>
          </div>
          {website.audits.length === 0 ? (
            <div className="px-5 py-9 text-center text-sm text-slate-500">No audits have been recorded for this website.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {website.audits.map((audit) => (
                <div key={audit.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Audit created {formatManagementDate(audit.createdAt)}</p>
                    <p className="mt-1 text-xs text-slate-500">{audit.completedAt ? `Completed ${formatManagementDate(audit.completedAt)}` : "Not completed"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-slate-700">{audit.overallScore == null ? "—" : `${audit.overallScore} / 100`}</span>
                    <AuditStatusBadge status={audit.status} />
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
