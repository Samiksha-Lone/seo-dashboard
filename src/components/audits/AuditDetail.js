"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import DownloadReportButton from "@/components/audits/DownloadReportButton";
import DeleteRecordButton from "@/components/management/DeleteRecordButton";
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
  { severity: "CRITICAL", title: "Critical issues", border: "border-l-rose-500", badge: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  { severity: "IMPORTANT", title: "Important issues", border: "border-l-amber-500", badge: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { severity: "QUICK_WIN", title: "Quick wins", border: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
];

const priorityStyles = {
  CRITICAL: "bg-rose-100 text-rose-800 ring-rose-600/20",
  HIGH: "bg-rose-50 text-rose-700 ring-rose-600/20",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-600/20",
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

function getScoreColor(score) {
  if (score == null) return "text-slate-900";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:shadow">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value || "—"}</p>
    </div>
  );
}

function IssueCard({ issue, borderStyle, badgeStyle }) {
  return (
    <article className={`rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm border-l-4 ${borderStyle}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${badgeStyle}`}>
          {issue.severity || "Issue"}
        </span>
        <h4 className="text-sm font-bold text-slate-900">{issue.title || issue.category}</h4>
        {issue.category && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{issue.category}</span>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50/70 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Finding</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{issue.finding}</p>
        </div>
        <div className="rounded-lg bg-indigo-50/40 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Suggested Fix</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 font-medium">{issue.fix}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
          <span className="text-slate-500">Impact:</span> {issue.estimatedImpact || "—"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
          <span className="text-slate-500">Effort:</span> {issue.effort || "—"}
        </span>
      </div>
      {issue.falsifiabilityCheck && (
        <div className="mt-3.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-700">
          <span className="font-bold text-slate-900">Verification check: </span>{issue.falsifiabilityCheck}
        </div>
      )}
    </article>
  );
}

function RecommendationCard({ recommendation }) {
  const priority = recommendation.priority?.toUpperCase();
  const badgeClass = priorityStyles[priority] || "bg-indigo-50 text-indigo-700 ring-indigo-600/20";

  return (
    <article className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${badgeClass}`}>
          {recommendation.priority || "Priority unavailable"}
        </span>
        {recommendation.category && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {recommendation.category}
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50/70 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observation</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{recommendation.finding}</p>
        </div>
        <div className="rounded-lg bg-indigo-50/40 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Recommended Action</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800 font-medium">{recommendation.fix}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
          <span className="text-slate-500">Impact:</span> {recommendation.estimatedImpact || "—"}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-slate-700 font-medium">
          <span className="text-slate-500">Effort:</span> {recommendation.effort || "—"}
        </span>
      </div>
      {recommendation.falsifiabilityCheck && (
        <div className="mt-3.5 rounded-lg border border-slate-200/80 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-700">
          <span className="font-bold text-slate-900">Verification check: </span>{recommendation.falsifiabilityCheck}
        </div>
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
        <div className="h-32 rounded-xl border border-slate-200 bg-white" />
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
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <h2 className="font-semibold text-base">Audit details are unavailable</h2>
        <p className="mt-1 text-sm text-rose-800">{error || "Audit not found."}</p>
        <button
          type="button"
          onClick={() => setRetry((value) => value + 1)}
          className="mt-4 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-rose-900 ring-1 ring-rose-200 hover:bg-rose-100"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasScoreBreakdown = scoreLabels.some(([key]) => audit.scoreBreakdown?.[key] != null);
  const scoreColor = getScoreColor(audit.overallScore);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{audit.website?.name || "Website unavailable"}</h2>
              <AuditStatusBadge status={audit.status} />
            </div>
            <a
              href={audit.website?.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 break-all text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {audit.website?.url || "Website URL unavailable"}
            </a>
            <p className="mt-1.5 text-xs text-slate-500">
              Assigned Client: <span className="font-semibold text-slate-700">{audit.website?.client?.businessName || "—"}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left sm:text-right sm:min-w-44">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall SEO Score</p>
              <p className={`mt-1 text-4xl font-extrabold tracking-tight tabular-nums ${scoreColor}`}>
                {audit.overallScore == null ? "—" : audit.overallScore}
                {audit.overallScore != null && <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>}
              </p>
            </div>
            {!activeStatuses.has(audit.status) && (
              <DeleteRecordButton
                resource="audits"
                recordId={audit.id}
                label={`${audit.website?.name || "website"} audit from ${formatAuditDate(audit.createdAt)}`}
                listHref="/audits"
              />
            )}
          </div>
        </div>
        {activeStatuses.has(audit.status) ? (
          <div role="status" className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm font-medium text-sky-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500" />
            </span>
            <span>{auditStatusLabel(audit.status)} — refreshing every 5 seconds.</span>
          </div>
        ) : (
          <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
            {lastUpdated ? `Status last checked ${formatAuditDate(lastUpdated, true)}.` : ""}
          </p>
        )}
        {pollError && (
          <p role="status" className="mt-3 text-xs text-amber-700">{pollError}</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Audit timestamps">
        <InfoCard label="Audit Queued" value={formatAuditDate(audit.createdAt, true)} />
        <InfoCard label="Crawling Started" value={formatAuditDate(audit.startedAt, true)} />
        <InfoCard label="Audit Completed" value={formatAuditDate(audit.completedAt, true)} />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5 sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">Score breakdown</h2>
          <p className="mt-0.5 text-xs text-slate-500">Individual category scores evaluated during this audit.</p>
        </div>
        {!hasScoreBreakdown ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Score breakdown is not available for this audit.</p>
        ) : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5">
            {scoreLabels.map(([key, label]) => {
              const score = audit.scoreBreakdown?.[key];
              const categoryColor = getScoreColor(score);
              return (
                <div key={key} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:bg-slate-50">
                  <p className="text-xs font-semibold text-slate-600">{label}</p>
                  <p className={`mt-2 text-2xl font-bold tabular-nums ${categoryColor}`}>
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
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{audit.executiveSummary}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No executive summary has been saved for this audit.</p>
        )}
      </section>

      {issueGroups.map((group) => {
        const issues = audit.issues.filter((issue) => issue.severity === group.severity);
        return (
          <section key={group.severity} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
              <h2 className="text-base font-semibold text-slate-900">{group.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{issues.length}</span>
            </div>
            {issues.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">No {group.title.toLowerCase()} were identified for this audit.</p>
            ) : (
              <div className="space-y-4 p-5 sm:p-6">
                {issues.map((issue) => (
                  <IssueCard key={issue.id} issue={issue} borderStyle={group.border} badgeStyle={group.badge} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Prioritized recommendations</h2>
            <p className="mt-0.5 text-xs text-slate-500">Action items sorted by impact and implementation priority.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{audit.recommendations.length}</span>
        </div>
        {audit.recommendations.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No recommendations are saved for this audit.</p>
        ) : (
          <div className="space-y-4 p-5 sm:p-6">
            {audit.recommendations.map((recommendation) => (
              <RecommendationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-base font-semibold text-slate-900">PDF Report Document</h2>
            <p className="mt-1 text-xs text-slate-500">
              {audit.report?.storage === "supabase"
                ? "Durable object storage · Supabase Storage"
                : audit.report?.storage === "local"
                  ? "Local storage adapter"
                  : "Storage location is unavailable."}
            </p>
          </div>
          {audit.report && (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`${reportsBase}/${encodeURIComponent(audit.report.id)}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                View web report
              </Link>
              <DownloadReportButton
                downloadUrl={audit.report.downloadUrl}
                fileName={audit.report.fileName}
              />
            </div>
          )}
        </div>
        {audit.report ? (
          <div className="mt-4 flex flex-col gap-1 rounded-lg bg-slate-50 p-3.5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono font-medium text-slate-800 break-all">{audit.report.fileName}</span>
            <span>Generated {formatAuditDate(audit.report.generatedAt)}</span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            {activeStatuses.has(audit.status)
              ? "The PDF report will be automatically compiled once audit crawling and analysis complete."
              : "A PDF report is not available for this audit."}
          </p>
        )}
      </section>
    </div>
  );
}
