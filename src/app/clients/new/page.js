import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import ClientForm from "@/components/management/ClientForm";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Add Client",
  description: "Create a client business profile in the EDGELINK SEO dashboard.",
};

export default async function NewClientPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link href="/clients" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Clients</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Client management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Add a client</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the client&apos;s business details.</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <ClientForm />
        </section>
      </div>
    </DashboardShell>
  );
}
