'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuditStatusBadge from '@/components/dashboard/AuditStatusBadge';
import DownloadReportButton from '@/components/audits/DownloadReportButton';

const issueSections = [
  { key: 'critical', title: 'Critical issues', tone: 'rose' },
  { key: 'important', title: 'Important issues', tone: 'amber' },
  { key: 'quickWins', title: 'Quick wins', tone: 'emerald' },
];
const scoreCategories = [
  ['technical', 'Technical'],
  ['onPage', 'On-page'],
  ['content', 'Content'],
  ['coreWebVitals', 'Core Web Vitals'],
  ['schema', 'Schema'],
];
const priorityTones = {
  HIGH: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  LOW: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};
const issueBorderTones = {
  rose: 'border-l-rose-200',
  amber: 'border-l-amber-200',
  emerald: 'border-l-emerald-200',
};
const scoreTones = {
  technical: 'bg-indigo-600',
  onPage: 'bg-violet-600',
  content: 'bg-sky-600',
  coreWebVitals: 'bg-emerald-600',
  schema: 'bg-amber-500',
};

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SectionHeading({ eyebrow, title, detail, count }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{eyebrow}</p>}
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {detail && <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>}
      </div>
      {count !== undefined && (
        <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
          {count}
        </span>
      )}
    </div>
  );
}

function FindingCard({ item, priority }) {
  const priorityClass = priorityTones[priority] || 'bg-indigo-50 text-indigo-700 ring-indigo-600/20';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {priority && (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${priorityClass}`}>
            {priority} priority
          </span>
        )}
        <h3 className="text-sm font-semibold text-slate-900">{item.title || item.category}</h3>
        {item.category && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item.category}</span>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finding</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.finding}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended fix</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.fix}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Impact</span> · {item.estimatedImpact || '—'}
        </span>
        <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-semibold text-slate-800">Effort</span> · {item.effort || '—'}
        </span>
      </div>
      {item.falsifiabilityCheck && (
        <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm leading-6 text-slate-700">
          <span className="font-semibold text-slate-900">How to verify: </span>{item.falsifiabilityCheck}
        </p>
      )}
    </article>
  );
}

function ScoreBreakdown({ scores }) {
  const available = scores && scoreCategories.some(([key]) => scores[key] != null);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <SectionHeading title="Score breakdown" detail="Category scores saved with this audit." />
      {!available ? (
        <p className="px-5 py-7 text-sm text-slate-500 sm:px-6">Score breakdown is not available for this audit.</p>
      ) : (
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
          {scoreCategories.map(([key, label]) => {
            const score = scores[key];
            return (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {score == null ? '—' : `${score} / 100`}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label} score ${score == null ? 'not available' : `${score} out of 100`}`}>
                  {score != null && (
                    <div className={`h-full rounded-full ${scoreTones[key]}`} style={{ width: `${score}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ReportDetail({
  reportId,
  apiUrl = `/api/reports/${encodeURIComponent(reportId)}`,
  clientBase = '/clients',
  auditBase = '/audits',
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(apiUrl, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load this report.');
        setReport(payload.data);
        setError('');
      })
      .catch((loadError) => {
        if (loadError.name !== 'AbortError') setError(loadError.message || 'Report details are unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, retry]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading report" className="animate-pulse space-y-4">
        <div className="h-44 rounded-xl border border-slate-200 bg-white" />
        <div className="h-48 rounded-xl border border-slate-200 bg-white" />
        <div className="h-32 rounded-xl border border-slate-200 bg-white" />
        <span className="sr-only">Loading report details…</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
        <h2 className="font-semibold">Report details are unavailable</h2>
        <p className="mt-1 text-sm text-rose-800">{error || 'Report not found.'}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-rose-200 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          Try again
        </button>
      </div>
    );
  }

  const { audit } = report;
  const { website, issues, recommendations } = audit;

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">SEO audit report</span>
                <AuditStatusBadge status={audit.status} />
              </div>
              <h2 className="mt-3 break-words text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{website.name}</h2>
              <a href={website.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-sm text-indigo-700 underline-offset-2 hover:underline">
                {website.url}
              </a>
              <p className="mt-3 text-sm text-slate-600">
                Prepared for{' '}
                {clientBase ? (
                  <Link href={`${clientBase}/${encodeURIComponent(website.client.id)}`} className="font-semibold text-slate-800 hover:text-indigo-700">
                    {website.client.businessName}
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-800">{website.client.businessName}</span>
                )}
                <span className="text-slate-500"> · {website.client.businessType} · {website.client.city}, {website.client.state}</span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 rounded-xl bg-indigo-50/70 p-4 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:min-w-64 lg:flex-col lg:items-end lg:bg-transparent lg:p-0">
              <div className="lg:text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall SEO score</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums text-slate-950">
                  {audit.overallScore == null ? '—' : audit.overallScore}
                  {audit.overallScore != null && <span className="ml-1 text-base font-medium text-slate-500">/ 100</span>}
                </p>
              </div>
              <DownloadReportButton downloadUrl={report.downloadUrl} fileName={report.fileName} />
            </div>
          </div>

          <div className={`mt-6 grid gap-3 border-t border-slate-100 pt-5 ${clientBase ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Report generated</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(report.generatedAt)}</p>
            </div>
            {clientBase && (
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Report identifier</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-700">{report.id}</p>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Audit record</p>
              <Link href={`${auditBase}/${encodeURIComponent(audit.id)}`} className="mt-1 inline-block break-all text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                View audit details
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ScoreBreakdown scores={audit.scoreBreakdown} />

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeading eyebrow="At a glance" title="Executive summary" />
        <div className="p-5 sm:p-6">
          {audit.executiveSummary ? (
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">{audit.executiveSummary}</p>
          ) : (
            <p className="text-sm text-slate-500">No executive summary was saved for this audit.</p>
          )}
        </div>
      </section>

      {issueSections.map(({ key, title, tone }) => (
        <section key={key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeading title={title} count={issues[key].length} />
          {issues[key].length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500 sm:px-6">No {title.toLowerCase()} are saved for this audit.</p>
          ) : (
            <div className={`space-y-3 border-l-2 ${issueBorderTones[tone]} p-4 sm:ml-6 sm:my-5 sm:py-0`}>
              {issues[key].map((item) => <FindingCard key={item.id} item={item} />)}
            </div>
          )}
        </section>
      ))}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeading title="Recommendations" detail="Prioritized actions saved with this audit." count={recommendations.length} />
        {recommendations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500 sm:px-6">No recommendations are saved for this audit.</p>
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {recommendations.map((item) => <FindingCard key={item.id} item={item} priority={item.priority} />)}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-slate-500">
        PDF downloads may be unavailable if a report file is no longer available.
      </p>
    </div>
  );
}
