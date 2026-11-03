"use client";

import Link from "next/link";
import { useState } from "react";

const fieldClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ClientForm({ client, onSaved, onCancel }) {
  const [values, setValues] = useState({
    businessName: client?.businessName || "",
    businessType: client?.businessType || "",
    city: client?.city || "",
    state: client?.state || "",
    phone: client?.phone || "",
  });
  const [error, setError] = useState("");
  const [savedClient, setSavedClient] = useState(null);
  const [saving, setSaving] = useState(false);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSavedClient(null);
    setSaving(true);
    try {
      const response = await fetch(
        client ? `/api/clients/${encodeURIComponent(client.id)}` : "/api/clients",
        {
          method: client ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, phone: values.phone.trim() || null }),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Unable to save this client.");
        return;
      }
      setSavedClient(result.data);
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
      {savedClient && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Client saved successfully.{" "}
          <Link className="font-semibold underline" href={`/clients/${savedClient.id}`}>
            View {savedClient.businessName}
          </Link>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">
          Business name
          <input
            required
            maxLength={160}
            name="businessName"
            value={values.businessName}
            onChange={updateField}
            className={fieldClass}
            placeholder="Acme Studio"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Business type
          <input
            required
            maxLength={100}
            name="businessType"
            value={values.businessType}
            onChange={updateField}
            className={fieldClass}
            placeholder="Professional services"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone <span className="font-normal text-slate-400">(optional)</span>
          <input
            type="tel"
            maxLength={40}
            name="phone"
            value={values.phone}
            onChange={updateField}
            className={fieldClass}
            placeholder="+1 555 0100"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          City
          <input
            required
            maxLength={100}
            name="city"
            value={values.city}
            onChange={updateField}
            className={fieldClass}
            placeholder="Austin"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          State / region
          <input
            required
            maxLength={100}
            name="state"
            value={values.state}
            onChange={updateField}
            className={fieldClass}
            placeholder="Texas"
          />
        </label>
      </div>

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
            href={client ? `/clients/${client.id}` : "/clients"}
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
          {saving ? "Saving…" : client ? "Save changes" : "Create client"}
        </button>
      </div>
    </form>
  );
}
