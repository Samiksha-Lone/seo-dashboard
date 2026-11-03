"use client";

import Link from "next/link";
import { useState } from "react";

const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function validateUrl(value) {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Website URL must use HTTP or HTTPS.";
    }
    if (url.username || url.password) {
      return "Website URL must not contain credentials.";
    }
    return "";
  } catch {
    return "Enter a valid HTTP or HTTPS URL.";
  }
}

export default function WebsiteForm({
  website,
  clients,
  initialClientId = "",
  onSaved,
  onCancel,
}) {
  const [values, setValues] = useState({
    name: website?.name || "",
    url: website?.url || "",
    clientId: website?.clientId || initialClientId || clients[0]?.id || "",
  });
  const [error, setError] = useState("");
  const [savedWebsite, setSavedWebsite] = useState(null);
  const [saving, setSaving] = useState(false);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    const urlError = validateUrl(values.url);
    if (urlError) {
      setError(urlError);
      return;
    }
    setError("");
    setSavedWebsite(null);
    setSaving(true);
    try {
      const response = await fetch(
        website ? `/api/websites/${encodeURIComponent(website.id)}` : "/api/websites",
        {
          method: website ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to save this website.");
        return;
      }
      setSavedWebsite(result.data);
      onSaved?.(result.data);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {savedWebsite && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Website saved successfully.{" "}
          <Link className="font-semibold underline" href={`/websites/${savedWebsite.id}`}>
            View {savedWebsite.name}
          </Link>
        </div>
      )}
      {clients.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Create a client before adding a website.{" "}
          <Link href="/clients" className="font-semibold underline">
            Add a client
          </Link>
        </div>
      ) : (
        <>
          <label className="block text-sm font-medium text-slate-700">
            Website name
            <input
              required
              maxLength={160}
              name="name"
              value={values.name}
              onChange={updateField}
              className={fieldClass}
              placeholder="Main website"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Website URL
            <input
              required
              type="url"
              maxLength={2048}
              name="url"
              value={values.url}
              onChange={updateField}
              className={fieldClass}
              placeholder="https://example.com"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Use an HTTP or HTTPS URL without embedded login credentials.
            </span>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Client
            <select
              required
              name="clientId"
              value={values.clientId}
              onChange={updateField}
              className={fieldClass}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.businessName} — {client.city}, {client.state}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            ) : (
              <Link
                href={website ? `/websites/${website.id}` : "/websites"}
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving…" : website ? "Save changes" : "Add website"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
