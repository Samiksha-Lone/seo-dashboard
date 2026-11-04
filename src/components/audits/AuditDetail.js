"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DownloadReportButton from "@/components/audits/DownloadReportButton";
import { auditStatusLabel, formatAuditDate } from "@/components/audits/format";

const activeStatuses = new Set(["QUEUED", "PROCESSING"]);
const scoreLabels = [
  ["technical", "Technical"],
  ["onPage", "On-page"],
  ["content", "Content"],
  ["coreWebVitals", "Core Web Vitals"],
  ["schema", "Schema"],
];
const issueGroups = [
  { severity: "CRITICAL", title: "Critical issues" },
  { severity: "IMPORTANT", title: "Important issues" },
  { severity: "QUICK_WIN", title: "Quick wins" },
];

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value || "—"}</p>
    </div>
  );
}

function IssueCard({ issue }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{issue.title || issue.category}</h4>
        {issue.category && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{issue.category}</span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{issue.finding}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-slate-900">Suggested fix: </span>{issue.fix}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Impact: {issue.estimatedImpact || "—"}</span>
        <span>Effort: {issue.effort || "—"}</span>
      </div>
      {issue.falsifiabilityCheck && (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">How to verify: </span>{issue.falsifiabilityCheck}
        </p>
      )}
    </article>
  );
}

function RecommendationCard({ recommendation }) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
          {recommendation.priority || "Priority unavailable"}
        </span>
        {recommendation.category && (
          <span className="text-xs font-medium text-slate-500">{recommendation.category}</span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{recommendation.finding}</p>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        <span className="font-semibold text-slate-900">Recommended fix: </span>{recommendation.fix}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Impact: {recommendation.estimatedImpact || "—"}</span>
        <span>Effort: {recommendation.effort || "—"}</span>
      </div>
      {recommendation.falsifiabilityCheck && (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">How to verify: </span>{recommendation.falsifiabilityCheck}
        </p>
      )}
    </article>
  );
}

export default function AuditDetail({
  auditId,
  apiBase = "/api/audits",
  reportsBase = "/reports",
}) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [pollError, setPollError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const auditStatus = audit?.status;

  const loadAudit = useCallback(async (signal) => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(auditId)}`, {
      signal,
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Unable to load this audit.");
    setAudit(payload.data);
    setLastUpdated(new Date());
    setError("");
    setPollError("");
  }, [apiBase, auditId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setAudit(null);
    setError("");
    loadAudit(controller.signal)
      .catch((loadError) => {
        if (loadError.name !== "AbortError") {
          setError(loadError.message || "Could not load this audit.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadAudit, retry]);

  useEffect(() => {
    if (!activeStatuses.has(auditStatus)) return undefined;
    let timer;
    let cancelled = false;
    const controller = new AbortController();

    async function refresh() {
      try {
        await loadAudit(controller.signal);
      } catch (refreshError) {
        if (!cancelled && refreshError.name !== "AbortError") {
          setPollError("Status refresh failed. We’ll try again shortly.");
        }
      }
      if (!cancelled) timer = setTimeout(refresh, 5000);
    }

    timer = setTimeout(refresh, 5000);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [auditStatus, loadAudit]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading audit" className="animate-pulse space-y-5">
        <div className="h-24 rounded-xl border border-slate-200 bg-white" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-xl border border-slate-200 bg-white" />)}
        </div>
        <div className="h-56 rounded-xl border border-slate-200 bg-white" />
        <span className="sr-only">Loading audit details…</span>
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <h2 className="font-semibold">Audit details are unavailable</h2>
        <p className="mt-1 text-sm text-rose-800">{error || "Audit not found."}</p>
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          className="mt-4 rounded-lg bg-white px-3 py-2 text-sm font-medium text-rose-900 ring-1 ring-rose-200 hover:bg-rose-100"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasScoreBreakdown = scoreLabels.some(([key]) => audit.scoreBreakdown?.[key] != null);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{audit.website?.name || "Website unavailable"}</h2>
              <AuditStatusBadge status={audit.status} />
            </div>
            <p className="mt-2 break-all text-sm text-slate-600">{audit.website?.url || "Website URL unavailable"}</p>
            <p className="mt-1 text-sm text-slate-500">
              Client: {audit.website?.client?.businessName || "—"}
            </p>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall SEO score</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-950">
              {audit.overallScore == null ? "—" : audit.overallScore}
              {audit.overallScore != null && <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>}
            </p>
          </div>
        </div>
        {activeStatuses.has(audit.status) ? (
          <p role="status" className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
            {auditStatusLabel(audit.status)} — this page refreshes the saved status every 5 seconds.
          </p>
        ) : (
          <p className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-500">
            {lastUpdated ? `Status last checked ${formatAuditDate(lastUpdated, true)}.` : ""}
          </p>
        )}
        {pollError && (
          <p role="status" className="mt-3 text-sm text-amber-700">{pollError}</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Audit timestamps">
        <InfoCard label="Created" value={formatAuditDate(audit.createdAt, true)} />
        <InfoCard label="Started" value={formatAuditDate(audit.startedAt, true)} />
        <InfoCard label="Completed" value={formatAuditDate(audit.completedAt, true)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-slate-900">Score breakdown</h2>
          <p className="mt-1 text-sm text-slate-500">Scores saved with this audit report.</p>
        </div>
        {!hasScoreBreakdown ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">Score breakdown is not available for this audit.</p>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
            {scoreLabels.map(([key, label]) => {
              const score = audit.scoreBreakdown?.[key];
              return (
                <div key={key} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
                    {score == null ? "—" : `${score}`}
                    {score != null && <span className="ml-1 text-xs font-normal text-slate-400">/ 100</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">Executive summary</h2>
        {audit.executiveSummary ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{audit.executiveSummary}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No executive summary has been saved for this audit.</p>
        )}
      </section>

      {issueGroups.map((group) => {
        const issues = audit.issues.filter((issue) => issue.severity === group.severity);
        return (
          <section key={group.severity} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-base font-semibold text-slate-900">{group.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{issues.length}</span>
            </div>
            {issues.length === 0 ? (
              <p className="px-5 py-7 text-sm text-slate-500">No {group.title.toLowerCase()} are saved for this audit.</p>
            ) : (
              <div className="space-y-3 p-5">{issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}</div>
            )}
          </section>
        );
      })}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recommendations</h2>
            <p className="mt-1 text-sm text-slate-500">Prioritized actions saved with this report.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{audit.recommendations.length}</span>
        </div>
        {audit.recommendations.length === 0 ? (
          <p className="px-5 py-7 text-sm text-slate-500">No recommendations are saved for this audit.</p>
        ) : (
          <div className="space-y-3 p-5">
            {audit.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">PDF report</h2>
            <p className="mt-1 text-xs text-slate-500">
              {audit.report?.storage === "supabase"
                ? "Stored in durable Supabase object storage."
                : audit.report?.storage === "local"
                  ? "Local demo storage is not durable production object storage."
                  : "Storage location is unavailable."}
            </p>
          </div>
          {audit.report && (
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <Link
                href={`${reportsBase}/${encodeURIComponent(audit.report.id)}`}
                className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
              >
                View report details
              </Link>
              <DownloadReportButton
                downloadUrl={audit.report.downloadUrl}
                fileName={audit.report.fileName}
              />
            </div>
          )}
        </div>
        {audit.report ? (
          <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:justify-between">
            <span className="break-all">{audit.report.fileName}</span>
            <span>
              Generated {formatAuditDate(audit.report.generatedAt)} ·{" "}
              {audit.report.storage === "supabase"
                ? "Stored in Supabase Storage"
                : audit.report.storage === "local"
                  ? "Stored locally"
                  : "Storage location unavailable"}
              {audit.report.notificationAttemptedAt
                ? ` · Mock notification attempted ${formatAuditDate(audit.report.notificationAttemptedAt)}`
                : ""}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {activeStatuses.has(audit.status)
              ? "The PDF will be available after the audit report is generated."
              : "A PDF report is not available for this audit."}
          </p>
        )}
      </section>
    </div>
  );
}
