import AuditStatusBadge from "@/components/dashboard/AuditStatusBadge";
import Link from "next/link";

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function AuditDesktopRow({ audit }) {
  const websiteName = audit.website?.name || audit.website?.url || "Website unavailable";
  const websiteUrl = audit.website?.url;
  const score = audit.score == null ? "—" : `${audit.score}`;

  return (
    <tr className="border-t border-slate-100 transition hover:bg-slate-50/80">
      <td className="px-5 py-4">
        <div className="max-w-[280px]">
          <Link
            href={`/audits/${audit.id}`}
            className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-600 focus-visible:outline-none focus-visible:underline"
          >
            {websiteName}
          </Link>
          {websiteUrl && <p className="mt-0.5 truncate text-xs text-slate-500">{websiteUrl}</p>}
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">
        {audit.client?.name ? (
          <span className="font-medium text-slate-700">{audit.client.name}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-900">
        {score}
        {audit.score != null && <span className="ml-1 text-xs font-normal text-slate-400">/ 100</span>}
      </td>
      <td className="px-5 py-4">
        <AuditStatusBadge status={audit.status} />
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
        {formatDate(audit.createdAt)}
      </td>
    </tr>
  );
}

function AuditMobileCard({ audit }) {
  const websiteName = audit.website?.name || audit.website?.url || "Website unavailable";
  const websiteUrl = audit.website?.url;
  const score = audit.score == null ? "—" : `${audit.score}`;

  return (
    <Link
      href={`/audits/${audit.id}`}
      className="block border-t border-slate-100 p-4 transition hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{websiteName}</p>
          {websiteUrl && <p className="mt-0.5 truncate text-xs text-slate-500">{websiteUrl}</p>}
        </div>
        <AuditStatusBadge status={audit.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 pt-2 text-xs text-slate-500">
        <span>Client: {audit.client?.name || "—"}</span>
        <span className="font-semibold text-slate-800">
          Score: {score}
          {audit.score != null && " / 100"}
        </span>
        <span>{formatDate(audit.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function RecentAudits({ audits }) {
  return (
    <section aria-labelledby="recent-audits-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 p-5 sm:px-6">
        <div>
          <h2 id="recent-audits-heading" className="text-base font-semibold text-slate-900">
            Recent audits
          </h2>
          <p className="mt-1 text-xs text-slate-500">Latest audit activity in your workspace.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/audits"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:underline"
          >
            View all audits →
          </Link>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {audits.length} of 8
          </span>
        </div>
      </div>
      {audits.length === 0 ? (
        <div className="border-t border-slate-100 px-5 py-12 text-center">
          <p className="text-sm font-semibold text-slate-800">No audits recorded yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Audits will automatically show up here as they are queued and completed.
          </p>
          <Link
            href="/audits/new"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Start an audit
          </Link>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-slate-50/80">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Website</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">SEO score</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Created</th>
                </tr>
              </thead>
              <tbody>{audits.map((audit) => <AuditDesktopRow key={audit.id} audit={audit} />)}</tbody>
            </table>
          </div>
          <div className="md:hidden">
            {audits.map((audit) => <AuditMobileCard key={audit.id} audit={audit} />)}
          </div>
        </>
      )}
    </section>
  );
}
