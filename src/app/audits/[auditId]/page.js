import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import AuditDetail from "@/components/audits/AuditDetail";
import { requirePageRole } from "@/services/auth";

export const metadata = {
  title: "Audit Details",
  description: "Review SEO audit status, score, findings, and recommendations.",
};

export default async function AuditDetailPage({ params }) {
  await requirePageRole(["ADMIN"]);
  return (
    <DashboardShell>
      <div className="space-y-6">
        <section>
          <Link href="/audits" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Audits</Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Audit details</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Audit report</h1>
        </section>
        <AuditDetail auditId={params.auditId} />
      </div>
    </DashboardShell>
  );
}
