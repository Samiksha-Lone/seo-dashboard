import Link from 'next/link';
import ReportDetail from '@/components/reports/ReportDetail';
import PortalShell from '@/components/layout/PortalShell';
import { requirePortalPage } from '@/services/auth';

export const metadata = {
  title: 'Report Details',
  description: 'Review your saved SEO report, score, and recommendations.',
};

export default async function PortalReportPage({ params }) {
  const session = await requirePortalPage();
  return (
    <PortalShell user={session.user}>
      <div className="space-y-5">
        <Link href="/portal/reports" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">← Your reports</Link>
        <section>
          <p className="text-sm font-medium text-slate-500">Saved audit report</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Report details</h1>
        </section>
        <ReportDetail
          reportId={params.reportId}
          apiUrl={`/api/portal/reports/${encodeURIComponent(params.reportId)}`}
          clientBase={null}
          auditBase="/portal/audits"
        />
      </div>
    </PortalShell>
  );
}
