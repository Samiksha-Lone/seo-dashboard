'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import LogoutButton from '@/components/auth/LogoutButton';

const navigation = [
  {
    label: 'Overview',
    href: '/portal',
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    label: 'Reports',
    href: '/portal/reports',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
  },
];

function NavigationIcon({ children }) {
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
      {children}
    </svg>
  );
}

function PortalSidebar({ pathname, mobileOpen, onNavigate }) {
  return (
    <aside
      id="client-portal-sidebar"
      aria-label="Client portal sidebar"
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:translate-x-0 ${
        mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
        <Link
          href="/portal"
          aria-label="EDGELINK client portal home"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm ring-2 ring-indigo-100">
            E
          </span>
          <span>
            <span className="block text-sm font-bold tracking-wider text-slate-950">EDGELINK</span>
            <span className="block text-[10px] font-semibold tracking-wider text-indigo-600">CLIENT PORTAL</span>
          </span>
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

      <nav aria-label="Client portal navigation" className="flex-1 space-y-1.5 px-3 py-6">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Navigation
        </p>
        {navigation.map((item) => {
          const active =
            item.href === '/portal'
              ? pathname === '/portal'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
              className={`group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-all ${
                active
                  ? 'bg-indigo-50/90 font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              }`}
            >
              <NavigationIcon>{item.icon}</NavigationIcon>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
          <p className="text-xs font-semibold text-slate-900">Your SEO workspace</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            View your assigned websites, recent audits, and downloaded performance reports.
          </p>
        </div>
      </div>
    </aside>
  );
}

function sectionForPath(pathname) {
  if (pathname.startsWith('/portal/reports/')) {
    return { title: 'Report details', description: 'Review your saved SEO report and recommendations' };
  }
  if (pathname === '/portal/reports') {
    return { title: 'Reports', description: 'Review reports for your assigned websites' };
  }
  if (pathname.startsWith('/portal/audits/')) {
    return { title: 'Audit details', description: 'Review audit findings for your website' };
  }
  return { title: 'Overview', description: 'Your websites and SEO activity' };
}

export default function PortalShell({ children, user }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const section = sectionForPath(pathname);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'C';

  return (
    <div className="min-h-screen bg-slate-50">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition-opacity md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <PortalSidebar
        pathname={pathname}
        mobileOpen={mobileNavOpen}
        onNavigate={() => setMobileNavOpen(false)}
      />
      <div className="min-h-screen md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-controls="client-portal-sidebar"
              aria-expanded={mobileNavOpen}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 md:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">{section.title}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{section.description}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="max-w-48 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="truncate text-xs font-semibold text-slate-800">{user?.name || 'Client Account'}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Client
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-500">{user?.email || ''}</p>
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 ring-2 ring-slate-200/60"
                aria-hidden="true"
              >
                {initials}
              </div>
            </div>
            <div className="hidden h-4 w-px bg-slate-200 sm:block" />
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
