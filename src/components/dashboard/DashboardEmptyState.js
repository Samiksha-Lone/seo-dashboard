import Link from "next/link";

export default function DashboardEmptyState() {
  return (
    <section className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm ring-4 ring-indigo-50">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M12 4v16m8-8H4" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">Welcome to your SEO workspace</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
              Your database is ready. Get started by adding a client profile and registering their website to queue audits and generate comprehensive SEO reports.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/clients/new"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Add first client
              </Link>
              <Link
                href="/websites/new"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Add website
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
