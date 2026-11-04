'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AuditStatusBadge from '@/components/dashboard/AuditStatusBadge';
import DownloadReportButton from '@/components/audits/DownloadReportButton';

const PAGE_SIZE = 20;

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function ReportList() {
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', clientId: '', from: '', to: '' });
  const [form, setForm] = useState(filters);

  const loadReports = useCallback(async (signal) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const response = await fetch(`/api/reports?${params}`, { signal, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Unable to load reports.');
    setReports(payload.data.reports);
    setClients(payload.data.clients);
    setTotal(payload.data.total);
    setError('');
  }, [filters, offset]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    loadReports(controller.signal)
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Reports are unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadReports]);

  function applyFilters(event) {
    event.preventDefault();
    setOffset(0);
    setFilters({ ...form, search: form.search.trim() });
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <form
        onSubmit={applyFilters}
        className="grid gap-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">Search client or website</span>
          <input
            type="search"
            value={form.search}
            maxLength={200}
            onChange={(event) => setForm({ ...form, search: event.target.value })}
            placeholder="Search business name or domain..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">Client</span>
          <select
            value={form.clientId}
            onChange={(event) => setForm({ ...form, clientId: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All clients</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.businessName}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">From date</span>
          <input
            type="date"
            value={form.from}
            onChange={(event) => setForm({ ...form, from: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">To date</span>
          <input
            type="date"
            value={form.to}
            onChange={(event) => setForm({ ...form, to: event.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
        <div className="flex items-center gap-2.5 sm:col-span-2 lg:col-span-5 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              const cleared = { search: '', clientId: '', from: '', to: '' };
              setForm(cleared);
              setFilters(cleared);
              setOffset(0);
            }}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </form>

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p className="font-semibold text-base">Reports could not be loaded</p>
          <p className="mt-1">{error}</p>
          <button type="button" onClick={() => loadReports().catch((loadError) => setError(loadError.message))} className="mt-3 font-semibold underline">
            Try again
          </button>
        </div>
      ) : loading ? (
        <div role="status" className="animate-pulse space-y-3">
          {[1, 2, 3].map((row) => <div key={row} className="h-24 rounded-xl border border-slate-200 bg-white" />)}
          <span className="sr-only">Loading reports…</span>
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M8 13h8M8 17h8" />
            </svg>
          </div>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">No reports found</h2>
          <p className="mt-1 text-sm text-slate-500">
            {filters.search || filters.clientId || filters.from || filters.to
              ? "No reports matched the selected filter criteria."
              : "Reports will automatically appear here once audits finish compiling."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">Client & website</th>
                    <th scope="col" className="px-5 py-3">Audit Domain</th>
                    <th scope="col" className="px-5 py-3">Score & Status</th>
                    <th scope="col" className="px-5 py-3">Generated</th>
                    <th scope="col" className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.id} className="transition hover:bg-slate-50/70 align-top">
                      <td className="px-5 py-4">
                        <Link href={`/reports/${encodeURIComponent(report.id)}`} className="font-bold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline">
                          {report.audit.website.client.businessName}
                        </Link>
                        <p className="mt-0.5 max-w-xs break-all text-xs text-slate-500">{report.audit.website.url}</p>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/audits/${encodeURIComponent(report.audit.id)}`} className="font-medium text-slate-800 hover:text-indigo-600">
                          {report.audit.website.name}
                        </Link>
                        <p className="mt-0.5 break-all font-mono text-[11px] text-slate-400">{report.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="mb-1.5 font-bold tabular-nums text-slate-900">{report.audit.overallScore == null ? '—' : `${report.audit.overallScore} / 100`}</p>
                        <AuditStatusBadge status={report.audit.status} />
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatDate(report.generatedAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <Link href={`/reports/${encodeURIComponent(report.id)}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                            View details →
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
            <div className="divide-y divide-slate-100 md:hidden">
              {reports.map((report) => (
                <article key={report.id} className="space-y-3 p-4 transition hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/reports/${encodeURIComponent(report.id)}`} className="text-sm font-bold text-slate-900 hover:text-indigo-600">
                        {report.audit.website.client.businessName}
                      </Link>
                      <p className="mt-0.5 break-all text-xs text-slate-500">{report.audit.website.url}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                      {report.audit.overallScore == null ? '—' : `${report.audit.overallScore}/100`}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2">
                    <AuditStatusBadge status={report.audit.status} />
                    <span className="text-xs text-slate-400">{formatDate(report.generatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Link href={`/reports/${encodeURIComponent(report.id)}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                      View report details
                    </Link>
                    <DownloadReportButton
                      downloadUrl={`/api/audits/${encodeURIComponent(report.audit.id)}/report`}
                      fileName={report.fileName}
                      compact
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-slate-600 sm:flex-row">
            <p>Showing {offset + 1}–{Math.min(offset + reports.length, total)} of {total} reports</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span aria-live="polite" className="font-medium text-slate-700">Page {page} of {pageCount}</span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
