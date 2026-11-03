"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AuditCreateForm() {
  const [websites, setWebsites] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingWebsites, setLoadingWebsites] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWebsites() {
      try {
        const response = await fetch("/api/audits/websites", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          setLoadError(payload.error || "Unable to load registered websites.");
          return;
        }
        setWebsites(payload.data);
        setSelectedId((current) => current || payload.data[0]?.id || "");
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError("Could not load registered websites. Check your connection and try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingWebsites(false);
      }
    }

    loadWebsites();
    return () => controller.abort();
  }, []);

  const selectedWebsite = websites.find((website) => website.id === selectedId);

  async function submit(event) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!selectedWebsite) {
      setSubmitError("Select a registered website before starting an audit.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const response = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: selectedWebsite.url,
          clientId: selectedWebsite.clientId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setSubmitError(payload.error || "Unable to start the audit.");
        return;
      }
      setResult({
        auditId: payload.auditId,
        status: payload.status,
        reused: Boolean(payload.reused),
      });
    } catch {
      setSubmitError("Could not reach the server. Check your connection and try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loadingWebsites) {
    return (
      <div role="status" className="animate-pulse space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-24 rounded-xl border border-slate-200 bg-white" />
        <span className="sr-only">Loading registered websites…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {loadError}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-2 font-semibold underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-sm font-semibold text-slate-900">No registered websites</h2>
        <p className="mt-2 text-sm text-slate-600">
          Audits can only be started for a website already associated with a client.
        </p>
        <Link
          href="/websites/new"
          className="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Add a website
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {submitError && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {submitError}
        </p>
      )}
      {result && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {result.reused
            ? "An audit is already queued or processing for this website."
            : "Audit queued successfully."}{" "}
          <Link href={`/audits/${result.auditId}`} className="font-semibold underline">
            View audit status
          </Link>
        </div>
      )}

      <fieldset disabled={submitting} className="space-y-4 disabled:opacity-70">
        <legend className="text-sm font-semibold text-slate-900">Choose a registered website</legend>
        <div className="grid gap-3">
          {websites.map((website) => {
            const selected = selectedId === website.id;
            return (
              <label
                key={website.id}
                className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                  selected
                    ? "border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="websiteId"
                  value={website.id}
                  checked={selected}
                  onChange={() => setSelectedId(website.id)}
                  className="mt-1 h-4 w-4 accent-indigo-600"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{website.name}</span>
                  <span className="mt-1 block break-all text-sm text-slate-600">{website.url}</span>
                  <span className="mt-2 block text-xs text-slate-500">
                    Client: {website.client.businessName}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">The audit runs in the background. You can leave this page after it is queued.</p>
        <button
          type="submit"
          disabled={submitting || !selectedWebsite}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Queueing audit…" : "Start audit"}
        </button>
      </div>
    </form>
  );
}
