import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import AuditList from "@/components/audits/AuditList";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Audits",
  description: "Review SEO audit history and current processing status.",
};

export default async function AuditsPage() {
  await requirePageRole(["ADMIN"]);
  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">Workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Audits</h1>
            <p className="mt-2 text-sm text-slate-600">Review audit history and current processing status.</p>
          </div>
          <Link
            href="/audits/new"
            className="inline-flex w-fit items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Start an audit
          </Link>
        </section>
        <AuditList />
      </div>
    </DashboardShell>
  );
}
