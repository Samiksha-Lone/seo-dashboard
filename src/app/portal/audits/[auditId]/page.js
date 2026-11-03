import Link from 'next/link';
import AuditDetail from '@/components/audits/AuditDetail';
import PortalShell from '@/components/layout/PortalShell';
import { requirePortalPage } from '@/services/auth';

export const metadata = {
  title: 'Audit Details',
  description: 'Review your website SEO audit status, score, and findings.',
};

export default async function PortalAuditPage({ params }) {
  const session = await requirePortalPage();
  return (
    <PortalShell user={session.user}>
      <div className="space-y-5">
        <Link href="/portal" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Your websites</Link>
        <section>
          <p className="text-sm font-medium text-slate-500">Audit details</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">SEO audit</h1>
        </section>
        <AuditDetail auditId={params.auditId} apiBase="/api/portal/audits" reportsBase="/portal/reports" />
      </div>
    </PortalShell>
  );
}
