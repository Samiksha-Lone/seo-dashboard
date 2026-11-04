import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import ManagementError from "@/components/management/ManagementError";
import WebsiteDialogButton from "@/components/management/WebsiteDialogButton";
import { formatManagementDate } from "@/lib/management/format";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Websites",
  description: "Manage registered websites and review their SEO audit activity.",
};

export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  await requirePageRole(["ADMIN"]);
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
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Workspace Management</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Websites</h1>
            <p className="mt-1.5 text-sm text-slate-600">Manage registered domains, audit history, and client associations.</p>
          </div>
          <WebsiteDialogButton clients={clients} label="Add website" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Website list">
          <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-slate-900">All registered domains</h2>
            <p className="mt-0.5 text-xs text-slate-500">{websites.length} website{websites.length === 1 ? "" : "s"} under management</p>
          </div>
          {websites.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 9h18M8 4v5" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">No websites yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a website and associate it with a client profile.</p>
              <div className="mt-5 flex justify-center">
                <WebsiteDialogButton clients={clients} label="Register first website" variant="primary" />
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {["Website", "Client", "Audits", "Latest audit", "Actions"].map((heading) => (
                        <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {websites.map((website) => (
                      <tr key={website.id} className="transition hover:bg-slate-50/80">
                        <td className="max-w-[340px] px-5 py-4">
                          <Link href={`/websites/${website.id}`} className="block text-sm font-bold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                            {website.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{website.url}</p>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/clients/${website.client.id}`} className="text-sm font-medium text-slate-800 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                            {website.client.businessName}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-400">{website.client.city}, {website.client.state}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-900">{website._count.audits}</td>
                        <td className="px-5 py-4">
                          {website.audits[0] ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <AuditStatusBadge status={website.audits[0].status} />
                              {website.audits[0].overallScore != null && (
                                <span className="text-xs font-bold tabular-nums text-slate-800">
                                  {website.audits[0].overallScore}/100
                                </span>
                              )}
                              <span className="text-xs text-slate-400">{formatManagementDate(website.audits[0].createdAt)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">No audits yet</span>
                          )}
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
                  <article key={website.id} className="p-4 transition hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/websites/${website.id}`} className="block truncate text-sm font-bold text-slate-900 hover:text-indigo-600">
                          {website.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{website.url}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {website._count.audits} audit{website._count.audits === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{website.client.businessName}</span>
                      <span className="text-slate-400"> · {website.client.city}, {website.client.state}</span>
                    </div>
                    {website.audits[0] && (
                      <div className="mt-2 flex items-center gap-2">
                        <AuditStatusBadge status={website.audits[0].status} />
                        {website.audits[0].overallScore != null && (
                          <span className="text-xs font-bold text-slate-800">
                            Score: {website.audits[0].overallScore}/100
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{formatManagementDate(website.audits[0].createdAt)}</span>
                      </div>
                    )}
                    <div className="mt-3 flex justify-end border-t border-slate-50 pt-2">
                      <WebsiteDialogButton website={website} clients={clients} label="Edit website" variant="text" />
                    </div>
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
