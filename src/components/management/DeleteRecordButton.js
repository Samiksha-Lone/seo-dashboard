"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRecordButton({
  resource,
  recordId,
  label,
  listHref,
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const endpoint = `/api/${resource}/${encodeURIComponent(recordId)}`;

  async function remove() {
    if (!window.confirm(`Delete "${label}"? This action cannot be undone.`)) return;
    setError("");
    setDeleting(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || `Unable to delete this ${resource.slice(0, -1)}.`);
        return;
      }
      router.push(listHref);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={deleting}
        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60"
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
