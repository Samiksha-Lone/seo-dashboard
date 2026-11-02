export default function DashboardEmptyState() {
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 ring-1 ring-indigo-100">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
            <path d="M12 3v18M3 12h18" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Your workspace is ready</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            There are no clients, websites, or audits in the database yet. Client and website
            management are not available in this release; once records are added, this overview
            will display their live activity.
          </p>
        </div>
      </div>
    </section>
  );
}
