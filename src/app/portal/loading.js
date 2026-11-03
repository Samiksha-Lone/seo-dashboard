export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-label="Loading client portal">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white md:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="h-9 w-9 animate-pulse rounded-xl bg-indigo-100" />
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-2 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
        <div className="space-y-3 px-6 py-7">
          <div className="h-2 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-indigo-50" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-50" />
        </div>
      </aside>
      <div className="min-h-screen md:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-10">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="hidden h-2 w-44 animate-pulse rounded bg-slate-100 sm:block" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
        </header>
        <main className="mx-auto w-full max-w-[1440px] space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="space-y-3">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-8 w-64 max-w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-100" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
          <div className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <span className="sr-only">Loading your portal data…</span>
        </main>
      </div>
    </div>
  );
}
