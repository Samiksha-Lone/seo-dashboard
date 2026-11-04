const lifecycleByStatus = {
  QUEUED: "pending",
  PROCESSING: "pending",
  IN_PROGRESS: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
};

export function getAuditLifecycleTotals(groups) {
  return groups.reduce(
    (totals, { status, _count }) => {
      const lifecycle = lifecycleByStatus[status];
      if (!lifecycle) {
        throw new Error(`Unmapped audit status in dashboard totals: ${status}`);
      }

      totals[lifecycle] += _count._all;
      return totals;
    },
    { pending: 0, completed: 0, failed: 0 }
  );
}
