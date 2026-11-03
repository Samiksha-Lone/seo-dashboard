import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import AuditCreateForm from "@/components/audits/AuditCreateForm";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Start an Audit",
  description: "Queue an SEO audit for a registered website.",
};

export default async function NewAuditPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section>
          <Link href="/audits" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Audits</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Audit management</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Start an audit</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose a registered website. Audits are queued and processed in the background.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <AuditCreateForm />
        </section>
      </div>
    </DashboardShell>
  );
}
