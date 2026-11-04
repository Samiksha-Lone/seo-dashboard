"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteRecordButton({
  resource,
  recordId,
  label,
  listHref,
  confirmationMessage,
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const endpoint = `/api/${resource}/${encodeURIComponent(recordId)}`;
  const consequences = {
    clients: "This permanently deletes the client, all its websites and audit history, issues, recommendations, and report metadata. It will also attempt to remove associated PDFs from storage.",
    websites: "This permanently deletes the website, all its audit history, issues, recommendations, and report metadata. It will also attempt to remove associated PDFs from storage.",
    audits: "This permanently deletes the audit, its issues, recommendations, and report metadata. It will also attempt to remove its PDF from storage.",
  };

  async function remove() {
    if (!window.confirm(confirmationMessage || `${consequences[resource] || "This permanently deletes the selected record and related data."}\n\nDelete "${label}"? This action cannot be undone.`)) return;
    setError("");
    setDeleting(true);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || `Unable to delete this ${resource.slice(0, -1)}.`);
        return;
      }
      if (result.data?.storageCleanupFailures > 0) {
        window.alert(
          "The database records were deleted, but one or more PDF files could not be removed from storage. An administrator should check the server logs and clean up those orphaned files.",
        );
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
