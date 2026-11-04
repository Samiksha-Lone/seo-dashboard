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
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active) setUser(payload?.data?.user || null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, []);
  const section = pathname.startsWith("/clients")
    ? "Clients"
    : pathname.startsWith("/websites")
      ? "Websites"
      : pathname.startsWith("/audits")
        ? "Audits"
        : pathname.startsWith("/reports")
          ? "Reports"
          : "Overview";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
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
        <div>
          <p className="text-sm font-semibold text-slate-900">{section}</p>
          <p className="hidden text-xs text-slate-500 sm:block">
            {section === "Overview" ? "SEO performance at a glance" : `Manage ${section.toLowerCase()} in your workspace`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium text-slate-700">{user?.name || "Workspace"}</p>
          <p className="text-[10px] text-slate-500">{user?.email || ""}</p>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
