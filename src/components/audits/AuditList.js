"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import { formatAuditDate } from "@/components/audits/format";

const pageSize = 25;

function AuditRow({ audit, onOpen }) {
  const label = `View audit for ${audit.website?.name || "website"}`;
  return (
    <tr
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={() => onOpen(audit.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(audit.id);
        }
      }}
      className="cursor-pointer border-t border-slate-100 outline-none hover:bg-slate-50 focus:bg-indigo-50"
    >
      <td className="max-w-[320px] px-5 py-4">
        <p className="truncate text-sm font-semibold text-slate-900">{audit.website?.name || "Website unavailable"}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{audit.website?.url || "—"}</p>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{audit.website?.client?.businessName || "—"}</td>
      <td className="px-5 py-4 text-sm font-medium tabular-nums text-slate-800">
        {audit.overallScore == null ? "—" : `${audit.overallScore} / 100`}
      </td>
      <td className="px-5 py-4"><AuditStatusBadge status={audit.status} /></td>
      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{formatAuditDate(audit.createdAt)}</td>
    </tr>
  );
}

export default function AuditList() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [audits, setAudits] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAudits() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) });
      if (status) params.set("status", status);
      try {
        const response = await fetch(`/api/audits?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          setError(payload.error || "Unable to load audits.");
          return;
        }
        setAudits(payload.data.audits);
        setTotal(payload.data.total);
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setError("Could not load audits. Check your connection and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadAudits();
    return () => controller.abort();
  }, [status, offset, retry]);

  function changeStatus(value) {
    setStatus(value);
    setOffset(0);
  }

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + audits.length, total);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit history">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Audit history</h2>
          <p className="mt-1 text-xs text-slate-500">{total} audit{total === 1 ? "" : "s"}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Status
          <select
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="PROCESSING">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div role="status" aria-label="Loading audits" className="animate-pulse space-y-3 p-5">
          {[1, 2, 3].map((item) => <div key={item} className="h-14 rounded-lg bg-slate-100" />)}
          <span className="sr-only">Loading audit history…</span>
        </div>
      ) : error ? (
        <div role="alert" className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Try again
          </button>
        </div>
      ) : audits.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">{status ? "No audits match this status" : "No audits yet"}</p>
          <p className="mt-1 text-sm text-slate-500">
            {status ? "Choose another status filter or start an audit." : "Start an audit for a registered website to see its history here."}
          </p>
          {!status && (
            <Link href="/audits/new" className="mt-4 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900">
              Start your first audit
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  {["Website", "Client", "SEO score", "Status", "Created"].map((heading) => (
                    <th key={heading} scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <AuditRow
                    key={audit.id}
                    audit={audit}
                    onOpen={(id) => router.push(`/audits/${encodeURIComponent(id)}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 md:hidden">
            {audits.map((audit) => (
              <Link key={audit.id} href={`/audits/${encodeURIComponent(audit.id)}`} className="block p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{audit.website?.name || "Website unavailable"}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{audit.website?.url || "—"}</p>
                  </div>
                  <AuditStatusBadge status={audit.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span>Client: {audit.website?.client?.businessName || "—"}</span>
                  <span>Score: {audit.overallScore == null ? "—" : `${audit.overallScore} / 100`}</span>
                  <span>{formatAuditDate(audit.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {!loading && !error && total > pageSize && (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {from}–{to} of {total}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
              disabled={offset === 0}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + pageSize)}
              disabled={offset + pageSize >= total}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
