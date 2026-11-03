import Link from 'next/link';
import { notFound } from 'next/navigation';
import AuditStatusBadge from '@/components/dashboard/AuditStatusBadge';
import StatCard from '@/components/dashboard/StatCard';
import PortalShell from '@/components/layout/PortalShell';
import { requirePortalPage } from '@/services/auth';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'Client Overview',
  description: 'View your assigned websites, SEO audit results, and recent activity.',
};

export const dynamic = 'force-dynamic';

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function EmptyState({ title, children }) {
  return (
    <div className="border-t border-slate-100 px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{children}</p>
    </div>
  );
}

function WebsiteCard({ website }) {
  const audit = website.audits[0];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{website.name}</h3>
          <a href={website.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-slate-500 hover:text-indigo-700">
            {website.url}
          </a>
        </div>
        {audit && (
          <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <AuditStatusBadge status={audit.status} />
            <p className="text-sm font-semibold tabular-nums text-slate-900">
              {audit.overallScore == null ? '—' : audit.overallScore}
              {audit.overallScore != null && <span className="ml-1 text-xs font-normal text-slate-400">/ 100</span>}
            </p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        {audit ? (
          <>
            <p className="text-xs text-slate-500">Latest audit · {formatDate(audit.createdAt)}</p>
            <div className="flex items-center gap-4">
              <Link href={`/portal/audits/${encodeURIComponent(audit.id)}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                View audit
              </Link>
              {audit.report && (
                <Link href={`/portal/reports/${encodeURIComponent(audit.report.id)}`} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                  View report
                </Link>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500">No audits are available yet.</p>
        )}
      </div>
    </article>
  );
}

function RecentActivity({ audits }) {
  return (
    <section aria-labelledby="portal-recent-audits" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2 id="portal-recent-audits" className="text-base font-semibold text-slate-900">Recent audit activity</h2>
          <p className="mt-1 text-sm text-slate-500">Latest activity across your assigned websites.</p>
        </div>
        <Link href="/portal/reports" className="shrink-0 text-sm font-medium text-indigo-700 hover:text-indigo-900">View reports</Link>
      </div>
      {audits.length === 0 ? (
        <EmptyState title="No audits yet">Audit activity will appear here after an audit is queued for one of your websites.</EmptyState>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Website</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">SEO score</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Report</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="max-w-[320px]">
                        <Link href={`/portal/audits/${encodeURIComponent(audit.id)}`} className="truncate text-sm font-medium text-indigo-700 hover:text-indigo-900">
                          {audit.website.name}
                        </Link>
                        <p className="mt-1 truncate text-xs text-slate-500">{audit.website.url}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium tabular-nums text-slate-800">
                      {audit.overallScore == null ? '—' : <>{audit.overallScore}<span className="ml-1 text-xs font-normal text-slate-400">/ 100</span></>}
                    </td>
                    <td className="px-5 py-4"><AuditStatusBadge status={audit.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(audit.createdAt)}</td>
                    <td className="px-5 py-4">
                      {audit.report ? (
                        <Link href={`/portal/reports/${encodeURIComponent(audit.report.id)}`} className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
                          View report
                        </Link>
                      ) : <span className="text-sm text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {audits.map((audit) => (
              <li key={audit.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/portal/audits/${encodeURIComponent(audit.id)}`} className="truncate text-sm font-medium text-indigo-700">
                      {audit.website.name}
                    </Link>
                    <p className="mt-1 truncate text-xs text-slate-500">{audit.website.url}</p>
                  </div>
                  <AuditStatusBadge status={audit.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span>Score: {audit.overallScore == null ? '—' : `${audit.overallScore} / 100`}</span>
                  <span>{formatDate(audit.createdAt)}</span>
                  {audit.report && (
                    <Link href={`/portal/reports/${encodeURIComponent(audit.report.id)}`} className="font-semibold text-indigo-700">View report</Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default async function PortalHomePage() {
  const session = await requirePortalPage();
  let client;
  let completedAudits;
  let reportCount;
  let recentAudits;
  try {
    [client, completedAudits, reportCount, recentAudits] = await Promise.all([
      prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: {
          id: true,
          businessName: true,
          businessType: true,
          city: true,
          state: true,
          websites: {
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              url: true,
              audits: {
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  status: true,
                  overallScore: true,
                  createdAt: true,
                  report: { select: { id: true } },
                },
              },
            },
          },
        },
      }),
      prisma.audit.count({
        where: { status: 'COMPLETED', website: { clientId: session.user.clientId } },
      }),
      prisma.report.count({
        where: { audit: { website: { clientId: session.user.clientId } } },
      }),
      prisma.audit.findMany({
        where: { website: { clientId: session.user.clientId } },
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          overallScore: true,
          createdAt: true,
          report: { select: { id: true } },
          website: { select: { name: true, url: true } },
        },
      }),
    ]);
  } catch (error) {
    console.error('Client portal page query failed:', {
      name: error?.name || 'Error',
      code: error?.code || 'UNKNOWN',
    });
    return (
      <PortalShell user={session.user}>
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          Your portal data is temporarily unavailable. Please try again later.
        </div>
      </PortalShell>
    );
  }
  if (!client) notFound();

  return (
    <PortalShell user={session.user}>
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500">Workspace overview</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Welcome, {client.businessName}
            </h1>
            <p className="mt-2 text-sm text-slate-600">Your assigned websites, audit results, and saved reports.</p>
          </div>
          <p className="text-sm text-slate-500 sm:text-right">
            {client.businessType}<br className="hidden sm:block" />
            <span className="sm:mt-1 sm:block">{client.city}, {client.state}</span>
          </p>
        </section>

        <section aria-label="Client account metrics">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Assigned websites"
              value={client.websites.length}
              detail="Websites in your workspace"
              icon="websites"
            />
            <StatCard
              label="Completed audits"
              value={completedAudits}
              detail="Audits with completed results"
              icon="audits"
            />
            <StatCard
              label="Available reports"
              value={reportCount}
              detail="Saved reports for your websites"
              icon="reports"
            />
          </div>
        </section>

        <section aria-labelledby="portal-websites-heading">
          <div className="mb-4">
            <h2 id="portal-websites-heading" className="text-base font-semibold text-slate-900">Your websites</h2>
            <p className="mt-1 text-sm text-slate-500">Latest audit status and SEO score for each assigned website.</p>
          </div>
          {client.websites.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <EmptyState title="No websites assigned">Your administrator can add websites to your workspace. They’ll appear here when available.</EmptyState>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {client.websites.map((website) => <WebsiteCard key={website.id} website={website} />)}
            </div>
          )}
        </section>

        <RecentActivity audits={recentAudits} />
      </div>
    </PortalShell>
  );
}
