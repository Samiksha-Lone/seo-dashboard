import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ClientDialogButton from "@/components/management/ClientDialogButton";
import ManagementError from "@/components/management/ManagementError";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
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
            <p className="text-sm font-medium text-slate-500">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Clients</h1>
            <p className="mt-2 text-sm text-slate-600">Manage business profiles and their registered websites.</p>
          </div>
          <ClientDialogButton label="Add client" />
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Client list">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">All clients</h2>
              <p className="mt-1 text-xs text-slate-500">{clients.length} client{clients.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          {clients.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">No clients yet</p>
              <p className="mt-1 text-sm text-slate-500">Add your first client to start organizing websites.</p>
              <div className="mt-4 flex justify-center">
                <ClientDialogButton label="Create a client" variant="secondary" />
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Business", "Type", "Location", "Phone", "Websites", "Actions"].map((heading) => (
                        <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <Link href={`/clients/${client.id}`} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                            {client.businessName}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{client.businessType}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{client.city}, {client.state}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{client.phone || "—"}</td>
                        <td className="px-5 py-4 text-sm font-medium tabular-nums text-slate-800">{client._count.websites}</td>
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
                  <article key={client.id} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50">
                    <Link href={`/clients/${client.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{client.businessName}</p>
                          <p className="mt-1 text-xs text-slate-500">{client.businessType}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {client._count.websites} website{client._count.websites === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{client.city}, {client.state}{client.phone ? ` · ${client.phone}` : ""}</p>
                    </Link>
                    <ClientDialogButton client={client} label="Edit" variant="text" />
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
