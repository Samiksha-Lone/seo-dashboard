const iconContent = {
  clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  websites: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></>,
  audits: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" /></>,
  score: <><path d="M12 3v3M5.64 5.64l2.12 2.12M3 12h3M5.64 18.36l2.12-2.12M12 21v-3M18.36 18.36l-2.12-2.12M21 12h-3M18.36 5.64l-2.12 2.12" /><circle cx="12" cy="12" r="5" /></>,
};

export default function StatCard({ label, value, detail, icon, suffix }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
            {iconContent[icon]}
          </svg>
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <p className="text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
        {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}
