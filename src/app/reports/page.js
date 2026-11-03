import DashboardShell from '@/components/layout/DashboardShell';
import ReportList from '@/components/reports/ReportList';
import { requirePageRole } from '@/services/auth';

export const metadata = {
  title: 'Reports',
  description: 'Search generated SEO audit reports and download PDF files.',
};

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  await requirePageRole(['ADMIN']);
  return (
    <DashboardShell>
      <div className="space-y-6">
        <section>
          <p className="text-sm font-medium text-slate-500">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Reports
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Search generated audit reports and download their PDF files.
          </p>
        </section>
        <ReportList />
      </div>
    </DashboardShell>
  );
}
