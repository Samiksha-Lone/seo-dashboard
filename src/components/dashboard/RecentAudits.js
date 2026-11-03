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
    <tr className="border-t border-slate-100">
      <td className="px-5 py-4">
        <div className="max-w-[260px]">
          <Link href={`/audits/${audit.id}`} className="truncate text-sm font-medium text-indigo-700 hover:text-indigo-900">
            {websiteName}
          </Link>
          {websiteUrl && <p className="mt-1 truncate text-xs text-slate-500">{websiteUrl}</p>}
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-slate-600">{audit.client?.name || "—"}</td>
      <td className="px-5 py-4 text-sm font-medium tabular-nums text-slate-800">
        {score}{audit.score == null ? "" : <span className="ml-1 text-xs font-normal text-slate-400">/ 100</span>}
      </td>
      <td className="px-5 py-4"><AuditStatusBadge status={audit.status} /></td>
      <td className="px-5 py-4 text-sm text-slate-500">{formatDate(audit.createdAt)}</td>
    </tr>
  );
}

function AuditMobileCard({ audit }) {
  const websiteName = audit.website?.name || audit.website?.url || "Website unavailable";
  const websiteUrl = audit.website?.url;
  const score = audit.score == null ? "—" : `${audit.score}`;

  return (
    <Link href={`/audits/${audit.id}`} className="block border-t border-slate-100 p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{websiteName}</p>
          {websiteUrl && <p className="mt-1 truncate text-xs text-slate-500">{websiteUrl}</p>}
        </div>
        <AuditStatusBadge status={audit.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>Client: {audit.client?.name || "—"}</span>
        <span>Score: {score}{audit.score == null ? "" : " / 100"}</span>
        <span>{formatDate(audit.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function RecentAudits({ audits }) {
  return (
    <section aria-labelledby="recent-audits-heading" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <h2 id="recent-audits-heading" className="text-base font-semibold text-slate-900">Recent audits</h2>
          <p className="mt-1 text-sm text-slate-500">The latest audit activity in your workspace.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {audits.length} of 8
        </span>
      </div>
      {audits.length === 0 ? (
        <div className="border-t border-slate-100 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No audits yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Audits will appear here after one is queued for a website.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Website</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Client</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">SEO score</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th scope="col" className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
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
