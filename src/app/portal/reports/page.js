import PortalReportsList from '@/components/reports/PortalReportsList';
import PortalShell from '@/components/layout/PortalShell';
import { requirePortalPage } from '@/services/auth';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Client Reports',
  description: 'View and download SEO audit reports for your assigned websites.',
};

export const dynamic = 'force-dynamic';

export default async function PortalReportsPage() {
  const session = await requirePortalPage();
  let reports;
  try {
    reports = await prisma.report.findMany({
      where: { audit: { website: { clientId: session.user.clientId } } },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        generatedAt: true,
        audit: {
          select: {
            id: true,
            status: true,
            overallScore: true,
            website: { select: { name: true, url: true } },
          },
        },
      },
    });
  } catch (error) {
    console.error('Client portal reports query failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return (
      <PortalShell user={session.user}>
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          Reports are temporarily unavailable. Please try again later.
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell user={session.user}>
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">Client workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Reports</h1>
            <p className="mt-2 text-sm text-slate-600">Saved SEO audit reports for your assigned websites.</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'}
          </span>
        </section>
        <PortalReportsList reports={reports} />
      </div>
    </PortalShell>
  );
}
