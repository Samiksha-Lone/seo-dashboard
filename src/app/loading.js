import DashboardShell from "@/components/layout/DashboardShell";

export default function Loading() {
  return (
    <DashboardShell>
      <div role="status" aria-label="Loading dashboard" className="animate-pulse space-y-8">
        <div>
          <div className="h-3 w-36 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-64 rounded bg-slate-200" />
          <div className="mt-3 h-4 w-80 max-w-full rounded bg-slate-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-36 rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white" />
        <span className="sr-only">Loading dashboard data…</span>
      </div>
    </DashboardShell>
  );
}
