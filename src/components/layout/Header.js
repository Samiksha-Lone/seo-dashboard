"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";

export default function Header({ onMenuClick }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active) setUser(payload?.data?.user || null);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const section = pathname.startsWith("/clients")
    ? { title: "Clients", description: "Manage business profiles and websites" }
    : pathname.startsWith("/websites")
      ? { title: "Websites", description: "Manage monitored domains and audit history" }
      : pathname.startsWith("/audits")
        ? { title: "Audits", description: "Review SEO audits and processing pipeline" }
        : pathname.startsWith("/reports")
          ? { title: "Reports", description: "Search and download generated PDF reports" }
          : { title: "Overview", description: "SEO performance at a glance" };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "A";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          aria-controls="dashboard-sidebar"
          className="md:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">{section.title}</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            {section.description}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-xs font-semibold text-slate-800">{user?.name || "Administrator"}</span>
              <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500">{user?.email || "admin@edgelink.test"}</p>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 ring-2 ring-indigo-50"
            aria-hidden="true"
          >
            {initials}
          </div>
        </div>
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <LogoutButton />
      </div>
    </header>
  );
}
