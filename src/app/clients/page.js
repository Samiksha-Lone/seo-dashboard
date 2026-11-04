import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ClientDialogButton from "@/components/management/ClientDialogButton";
import ManagementError from "@/components/management/ManagementError";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Clients",
  description: "Manage client business profiles and their registered websites.",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageRole(["ADMIN"]);
  let clients;
  try {
    clients = await prisma.client.findMany({
      orderBy: { businessName: "asc" },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        city: true,
        state: true,
        phone: true,
        user: { select: { email: true, isActive: true } },
        _count: { select: { websites: true } },
      },
    });
  } catch (error) {
    console.error("Client page query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return (
      <DashboardShell>
        <ManagementError item="Client" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Workspace Management</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Clients</h1>
            <p className="mt-1.5 text-sm text-slate-600">Manage business profiles, access credentials, and assigned websites.</p>
          </div>
          <ClientDialogButton label="Add client" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Client list">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">All registered clients</h2>
              <p className="mt-0.5 text-xs text-slate-500">{clients.length} client{clients.length === 1 ? "" : "s"} in workspace</p>
            </div>
          </div>
          {clients.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="10" cy="7" r="4" />
                  <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">No clients yet</p>
              <p className="mt-1 text-sm text-slate-500">Add your first client business to start registering websites.</p>
              <div className="mt-5 flex justify-center">
                <ClientDialogButton label="Create first client" variant="primary" />
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {["Business", "Industry", "Location", "Portal access", "Websites", "Actions"].map((heading) => (
                        <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                            {client.businessName}
                          </Link>
                          {client.phone && <p className="mt-0.5 text-xs text-slate-400">{client.phone}</p>}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{client.businessType}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{client.city}, {client.state}</td>
                        <td className="px-5 py-4 text-sm">
                          {client.user ? (
                            <div>
                              <span className="block font-medium text-slate-800">{client.user.email}</span>
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${client.user.isActive ? "text-emerald-700" : "text-slate-500"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${client.user.isActive ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
                                {client.user.isActive ? "Active login" : "Inactive"}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Not provisioned</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-900">{client._count.websites}</td>
                        <td className="px-5 py-4">
                          <ClientDialogButton client={client} label="Edit" variant="text" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-slate-100 md:hidden">
                {clients.map((client) => (
                  <article key={client.id} className="p-4 transition hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/clients/${client.id}`} className="block truncate text-sm font-bold text-slate-900 hover:text-indigo-600">
                          {client.businessName}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">{client.businessType}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {client._count.websites} website{client._count.websites === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2 text-xs text-slate-500">
                      <span>{client.city}, {client.state}{client.phone ? ` · ${client.phone}` : ""}</span>
                      <ClientDialogButton client={client} label="Edit client" variant="text" />
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
