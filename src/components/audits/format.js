export function formatAuditDate(value, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(date);
}

export function auditStatusLabel(status) {
  const labels = {
    QUEUED: "Queued",
    PROCESSING: "In progress",
    COMPLETED: "Completed",
    FAILED: "Failed",
  };
  return labels[status] || "Unknown";
}
