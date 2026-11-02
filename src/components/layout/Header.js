"use client";

export default function Header({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-controls="dashboard-sidebar"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <div>
          <p className="text-sm font-semibold text-slate-900">Overview</p>
          <p className="hidden text-xs text-slate-500 sm:block">SEO performance at a glance</p>
        </div>
      </div>
      <div
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3"
        aria-label="Profile placeholder, UI only"
        title="UI-only profile placeholder. Authentication is not implemented."
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          UI
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium text-slate-700">Profile placeholder</span>
          <span className="block text-[10px] text-slate-500">UI only</span>
        </span>
      </div>
    </header>
  );
}
