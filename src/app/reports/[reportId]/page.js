import Link from 'next/link';
import DashboardShell from '@/components/layout/DashboardShell';
import ReportDetail from '@/components/reports/ReportDetail';
import { requirePageRole } from '@/services/auth';

export const metadata = {
  title: 'Report Details',
  description: 'Review a saved SEO report, findings, and recommendations.',
};

export default async function ReportDetailPage({ params }) {
  await requirePageRole(['ADMIN']);
  return (
    <DashboardShell>
      <div className="space-y-6">
        <section>
          <Link href="/reports" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            ← Reports
          </Link>
          <p className="mt-5 text-sm font-medium text-slate-500">Saved audit report</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Report details
          </h1>
        </section>
        <ReportDetail reportId={params.reportId} />
      </div>
    </DashboardShell>
  );
}
