'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AuditStatusBadge from '@/components/dashboard/AuditStatusBadge';
import DownloadReportButton from '@/components/audits/DownloadReportButton';

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function EmptyResults({ searching }) {
  return (
    <div className="border-t border-slate-100 px-5 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{searching ? 'No matching reports' : 'No reports yet'}</p>
      <p className="mt-1 text-sm text-slate-500">
        {searching
          ? 'Try another website name or URL.'
          : 'Reports will appear here after an SEO audit has completed and its report is saved.'}
      </p>
    </div>
  );
}

export default function PortalReportsList({ reports }) {
  const [search, setSearch] = useState('');
  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter(({ audit }) => (
      audit.website.name.toLowerCase().includes(query)
      || audit.website.url.toLowerCase().includes(query)
    ));
  }, [reports, search]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Saved reports</h2>
          <p className="mt-1 text-sm text-slate-500">
            {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
            {search.trim() ? ` matching “${search.trim()}”` : ' available'}
          </p>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search reports by website name or URL</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports"
            className="block h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </div>
      {filteredReports.length === 0 ? (
        <EmptyResults searching={Boolean(search.trim())} />
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Website</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Report date</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">SEO score</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Audit status</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <div className="max-w-[320px]">
                        <Link href={`/portal/reports/${encodeURIComponent(report.id)}`} className="truncate text-sm font-medium text-indigo-700 hover:text-indigo-900">
                          {report.audit.website.name}
                        </Link>
                        <p className="mt-1 truncate text-xs text-slate-500">{report.audit.website.url}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{formatDate(report.generatedAt)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium tabular-nums text-slate-800">
                      {report.audit.overallScore == null ? '—' : <>{report.audit.overallScore}<span className="ml-1 text-xs font-normal text-slate-400">/ 100</span></>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4"><AuditStatusBadge status={report.audit.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/portal/reports/${encodeURIComponent(report.id)}`} className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                          Details
                        </Link>
                        <DownloadReportButton
                          downloadUrl={`/api/audits/${encodeURIComponent(report.audit.id)}/report`}
                          fileName={report.fileName}
                          compact
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 xl:hidden">
            {filteredReports.map((report) => (
              <li key={report.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/portal/reports/${encodeURIComponent(report.id)}`} className="text-sm font-semibold text-indigo-700">
                      {report.audit.website.name}
                    </Link>
                    <p className="mt-1 break-all text-xs text-slate-500">{report.audit.website.url}</p>
                  </div>
                  <AuditStatusBadge status={report.audit.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span>{formatDate(report.generatedAt)}</span>
                  <span>Score: {report.audit.overallScore == null ? '—' : `${report.audit.overallScore} / 100`}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <Link href={`/portal/reports/${encodeURIComponent(report.id)}`} className="text-sm font-medium text-indigo-700">View details</Link>
                  <DownloadReportButton
                    downloadUrl={`/api/audits/${encodeURIComponent(report.audit.id)}/report`}
                    fileName={report.fileName}
                    compact
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
