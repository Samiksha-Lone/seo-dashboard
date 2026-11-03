import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import WebsiteForm from "@/components/management/WebsiteForm";
import ManagementError from "@/components/management/ManagementError";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Add Website",
  description: "Register a website and assign it to a client.",
};

export const dynamic = "force-dynamic";

export default async function NewWebsitePage({ searchParams }) {
  await requirePageRole(["ADMIN"]);
  let clients;
  try {
    clients = await prisma.client.findMany({
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true, city: true, state: true },
    });
  } catch (error) {
    console.error("Website creation page query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Client" /></DashboardShell>;
  }

  const selectedClientId = typeof searchParams?.clientId === "string" ? searchParams.clientId : "";
  const selectedClient = clients.find((client) => client.id === selectedClientId);

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link href="/websites" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Websites</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Website management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Add a website</h1>
          <p className="mt-2 text-sm text-slate-600">Register an HTTP or HTTPS website and choose its client.</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <WebsiteForm clients={clients} initialClientId={selectedClient?.id || ""} />
        </section>
      </div>
    </DashboardShell>
  );
}
