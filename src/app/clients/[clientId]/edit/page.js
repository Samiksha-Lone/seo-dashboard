import Link from "next/link";
import { notFound } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import ClientForm from "@/components/management/ClientForm";
import ManagementError from "@/components/management/ManagementError";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Edit Client",
  description: "Update a client business profile.",
};

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }) {
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
      },
    });
  } catch (error) {
    console.error("Client edit query failed:", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return <DashboardShell><ManagementError item="Client" /></DashboardShell>;
  }
  if (!client) notFound();

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link href={`/clients/${client.id}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← {client.businessName}</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Client management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Edit client</h1>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <ClientForm client={client} />
        </section>
      </div>
    </DashboardShell>
  );
}
