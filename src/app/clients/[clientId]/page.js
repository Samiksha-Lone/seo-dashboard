import Link from "next/link";
import { notFound } from "next/navigation";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DashboardShell from "@/components/layout/DashboardShell";
import DeleteRecordButton from "@/components/management/DeleteRecordButton";
import ClientDialogButton from "@/components/management/ClientDialogButton";
import ManagementError from "@/components/management/ManagementError";
import WebsiteDialogButton from "@/components/management/WebsiteDialogButton";
import ClientAccountManager from "@/components/management/ClientAccountManager";
import { formatManagementDate } from "@/lib/management/format";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Client Details",
  description: "Review a client profile, assigned websites, and audit activity.",
};

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }) {
  await requirePageRole(["ADMIN"]);
  let client;
  try {
    client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        createdAt: true,
        user: { select: { id: true, email: true, isActive: true, mustChangePassword: true } },
        websites: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            url: true,
            _count: { select: { audits: true } },
            audits: {
              take: 5,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                overallScore: true,
                createdAt: true,
                report: { select: { id: true } },
              },
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Client detail query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Client" /></DashboardShell>;
  }
  if (!client) notFound();

  const audits = client.websites
    .flatMap((website) => website.audits.map((audit) => ({ ...audit, website })))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:underline"
          >
            <span aria-hidden="true">←</span> Back to Clients
          </Link>
          <section className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Client Profile</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {client.businessName}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                {client.businessType} · {client.city}, {client.state}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <ClientDialogButton client={client} label="Edit client" variant="secondary" />
              <DeleteRecordButton resource="clients" recordId={client.id} label={client.businessName} listHref="/clients" />
            </div>
          </section>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            ["Industry", client.businessType],
            ["Location", `${client.city}, ${client.state}`],
            ["Contact phone", client.phone || "Not provided"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        <ClientAccountManager clientId={client.id} account={client.user} />

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Registered websites</h2>
              <p className="mt-0.5 text-xs text-slate-500">{client.websites.length} domain{client.websites.length === 1 ? "" : "s"} assigned</p>
            </div>
            <WebsiteDialogButton clients={[client]} initialClientId={client.id} label="Add website" variant="primary" />
          </div>
          {client.websites.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No websites added for this client yet</p>
              <p className="mt-1 text-xs text-slate-500">Register their domain to start automated audits and generate reports.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {client.websites.map((website) => (
                <article key={website.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center sm:px-6 hover:bg-slate-50/60 transition">
                  <div className="min-w-0">
                    <Link href={`/websites/${website.id}`} className="text-sm font-bold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                      {website.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{website.url}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {website._count.audits} audit{website._count.audits === 1 ? "" : "s"}
                    </span>
                    <Link
                      href={`/websites/${website.id}`}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Manage →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">Recent audit activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">Audit execution records across this client&apos;s registered websites.</p>
          </div>
          {audits.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-slate-500">
              No audit activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {audits.map((audit) => (
                <div key={audit.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 hover:bg-slate-50/60 transition">
                  <div className="min-w-0">
                    <Link href={`/audits/${audit.id}`} className="text-sm font-bold text-slate-900 hover:text-indigo-600">
                      {audit.website.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">{formatManagementDate(audit.createdAt)}</p>
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
                      Audit details
                    </Link>
                    {audit.report && (
                      <Link
                        href={`/reports/${audit.report.id}`}
                        className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        PDF Report
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
