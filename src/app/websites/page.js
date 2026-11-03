import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import ManagementError from "@/components/management/ManagementError";
import WebsiteDialogButton from "@/components/management/WebsiteDialogButton";
import { formatManagementDate } from "@/lib/management/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  let websites;
  let clients;
  try {
    [websites, clients] = await Promise.all([
      prisma.website.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        url: true,
        clientId: true,
        client: { select: { id: true, businessName: true, city: true, state: true } },
        _count: { select: { audits: true } },
        audits: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, overallScore: true, createdAt: true },
        },
      },
      }),
      prisma.client.findMany({
        orderBy: { businessName: "asc" },
        select: { id: true, businessName: true, city: true, state: true },
      }),
    ]);
  } catch (error) {
    console.error("Website page query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Website" /></DashboardShell>;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Websites</h1>
            <p className="mt-2 text-sm text-slate-600">Manage registered websites and review their audit activity.</p>
          </div>
          <WebsiteDialogButton clients={clients} label="Add website" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Website list">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">All websites</h2>
            <p className="mt-1 text-xs text-slate-500">{websites.length} website{websites.length === 1 ? "" : "s"}</p>
          </div>
          {websites.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No websites yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a website and associate it with a client.</p>
              <div className="mt-4 flex justify-center">
                <WebsiteDialogButton clients={clients} label="Add a website" variant="secondary" />
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Website", "Client", "Audits", "Latest audit", "Actions"].map((heading) => (
                        <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {websites.map((website) => (
                      <tr key={website.id} className="border-t border-slate-100">
                        <td className="max-w-[360px] px-5 py-4">
                          <Link href={`/websites/${website.id}`} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">{website.name}</Link>
                          <p className="mt-1 truncate text-xs text-slate-500">{website.url}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/clients/${website.client.id}`} className="text-sm text-slate-700 hover:text-indigo-700">{website.client.businessName}</Link>
                          <p className="mt-1 text-xs text-slate-500">{website.client.city}, {website.client.state}</p>
                        </td>
                        <td className="px-5 py-4 text-sm tabular-nums text-slate-700">{website._count.audits}</td>
                        <td className="px-5 py-4">
                          {website.audits[0] ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <AuditStatusBadge status={website.audits[0].status} />
                              <span className="text-xs text-slate-500">{formatManagementDate(website.audits[0].createdAt)}</span>
                            </div>
                          ) : <span className="text-sm text-slate-500">No audits</span>}
                        </td>
                        <td className="px-5 py-4">
                          <WebsiteDialogButton website={website} clients={clients} label="Edit" variant="text" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {websites.map((website) => (
                  <article key={website.id} className="flex items-center gap-3 p-4 hover:bg-slate-50">
                    <Link href={`/websites/${website.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{website.name}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{website.url}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {website._count.audits} audit{website._count.audits === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-600">{website.client.businessName} · {website.client.city}, {website.client.state}</p>
                      {website.audits[0] && (
                        <div className="mt-2 flex items-center gap-2">
                          <AuditStatusBadge status={website.audits[0].status} />
                          <span className="text-xs text-slate-500">{formatManagementDate(website.audits[0].createdAt)}</span>
                        </div>
                      )}
                    </Link>
                    <WebsiteDialogButton website={website} clients={clients} label="Edit" variant="text" />
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
