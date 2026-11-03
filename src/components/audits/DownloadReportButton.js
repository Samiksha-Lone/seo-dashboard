"use client";

import { useState } from "react";

export default function DownloadReportButton({ downloadUrl, fileName, compact = false }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function downloadReport() {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "The PDF report could not be downloaded.");
      }
      if (!response.headers.get("content-type")?.startsWith("application/pdf")) {
        throw new Error("The server did not return a PDF report.");
      }

      const disposition = response.headers.get("content-disposition");
      const downloadFileName = disposition?.match(/filename="([^"]+)"/i)?.[1] || fileName;
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(downloadError.message || "The PDF report could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={downloadReport}
        disabled={downloading}
        className={`inline-flex w-fit items-center justify-center bg-indigo-600 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
          compact ? 'rounded-md px-2.5 py-1.5 text-xs' : 'rounded-lg px-4 py-2.5 text-sm'
        }`}
      >
        {downloading ? "Preparing…" : "Download PDF"}
      </button>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
