"use client";

import { useEffect, useRef } from "react";

export default function ManagementModal({ title, onClose, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-modal-title"
        tabIndex={-1}
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Workspace management</p>
            <h2 id="management-modal-title" className="mt-1 text-lg font-semibold text-slate-950">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-5 sm:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
