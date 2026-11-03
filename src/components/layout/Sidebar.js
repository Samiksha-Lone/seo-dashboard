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
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    websites: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v5" /></>,
    audits: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" /></>,
    reports: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
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
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
          E
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-slate-950">EDGELINK</p>
          <p className="text-[11px] text-slate-500">SEO WORKSPACE</p>
        </div>
      </div>

      <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 px-3 py-6">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </p>
        {navigation.map((item) => {
          const active = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const commonClass = `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${
            active
              ? "bg-indigo-50 font-semibold text-indigo-700"
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
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">SEO workspace</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Manage your client profiles and their registered websites.
          </p>
        </div>
      </div>
    </aside>
  );
}
