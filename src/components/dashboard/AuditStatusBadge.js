const statusStyles = {
  QUEUED: "bg-amber-50 text-amber-700 ring-amber-600/20",
  PROCESSING: "bg-sky-50 text-sky-700 ring-sky-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export default function AuditStatusBadge({ status }) {
  const knownStatus = statusStyles[status] ? status : "FAILED";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[knownStatus]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status || "UNKNOWN"}
    </span>
  );
}
