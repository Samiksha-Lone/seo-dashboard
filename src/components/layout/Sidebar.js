"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { label: "Overview", href: "/", icon: "overview", available: true },
  { label: "Clients", href: "/clients", icon: "clients", available: true },
  { label: "Websites", href: "/websites", icon: "websites", available: true },
  { label: "Audits", href: "/audits", icon: "audits", available: true },
  { label: "Reports", href: "/reports", icon: "reports", available: true },
];

function NavIcon({ name }) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    clients: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    websites: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 4v5" />
      </>
    ),
    audits: (
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
      </>
    ),
    reports: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-105"
    >
      {paths[name]}
    </svg>
  );
}

export default function Sidebar({ mobileOpen, onNavigate }) {
  const pathname = usePathname();

  return (
    <aside
      id="dashboard-sidebar"
      aria-label="Main sidebar"
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:translate-x-0 ${
        mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm ring-2 ring-indigo-100">
            E
          </div>
          <div>
            <p className="text-sm font-bold tracking-wider text-slate-950">EDGELINK</p>
            <p className="text-[10px] font-semibold tracking-wider text-indigo-600">SEO WORKSPACE</p>
          </div>
        </Link>
        {mobileOpen && (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close sidebar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <nav aria-label="Dashboard navigation" className="flex-1 space-y-1.5 px-3 py-6">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Navigation
        </p>
        {navigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const commonClass = `group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
            active
              ? "bg-indigo-50/90 font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          }`;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={commonClass}
              onClick={onNavigate}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-900">Admin Console</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Full control over clients, domains, audit queues, and PDF reports.
          </p>
        </div>
      </div>
    </aside>
  );
}
