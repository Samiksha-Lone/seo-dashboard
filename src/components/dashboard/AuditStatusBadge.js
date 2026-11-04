const statusStyles = {
  QUEUED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PROCESSING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const statusLabels = {
  QUEUED: "Queued",
  PROCESSING: "In progress",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export default function AuditStatusBadge({ status, className = "" }) {
  const knownStatus = statusStyles[status] ? status : null;
  const isProcessing = knownStatus === "PROCESSING";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        statusStyles[knownStatus] || "bg-slate-50 text-slate-600 ring-slate-500/20"
      } ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
        {isProcessing && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"
            aria-hidden="true"
          />
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      </span>
      {statusLabels[knownStatus] || "Unknown"}
    </span>
  );
}
