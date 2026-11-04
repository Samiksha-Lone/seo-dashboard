import test from "node:test";
import assert from "node:assert/strict";
import { getAuditLifecycleTotals } from "../src/lib/dashboard/audit-lifecycle.mjs";

test("maps every Prisma audit status to a dashboard lifecycle total", () => {
  const totals = getAuditLifecycleTotals([
    { status: "QUEUED", _count: { _all: 1 } },
    { status: "PROCESSING", _count: { _all: 2 } },
    { status: "COMPLETED", _count: { _all: 3 } },
    { status: "FAILED", _count: { _all: 4 } },
  ]);

  assert.deepEqual(totals, { pending: 3, completed: 3, failed: 4 });
});

test("counts IN_PROGRESS as pending for compatible status data", () => {
  assert.deepEqual(
    getAuditLifecycleTotals([{ status: "IN_PROGRESS", _count: { _all: 1 } }]),
    { pending: 1, completed: 0, failed: 0 }
  );
});

test("does not silently omit an unmapped audit status", () => {
  assert.throws(
    () => getAuditLifecycleTotals([{ status: "UNKNOWN", _count: { _all: 1 } }]),
    /Unmapped audit status in dashboard totals: UNKNOWN/
  );
});
