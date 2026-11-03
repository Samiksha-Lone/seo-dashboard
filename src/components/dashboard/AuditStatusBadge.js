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

export default function AuditStatusBadge({ status }) {
  const knownStatus = statusStyles[status] ? status : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        statusStyles[knownStatus] || "bg-slate-50 text-slate-600 ring-slate-500/20"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {statusLabels[knownStatus] || "Unknown"}
    </span>
  );
}
