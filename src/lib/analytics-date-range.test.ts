import test from "node:test";
import assert from "node:assert/strict";
import { analyticsDateRange } from "./analytics-date-range";

test("default seven days follows Bangkok midnight across year boundaries", () => {
  const range = analyticsDateRange({}, new Date("2025-12-31T18:00:00Z"));
  assert.equal(range.from, "2025-12-26");
  assert.equal(range.to, "2026-01-01");
  assert.equal(range.today, "2026-01-01");
  assert.equal(range.days, 7);
  assert.equal(range.error, null);
});

test("same-day filter includes the full final Bangkok day with an exclusive end", () => {
  const range = analyticsDateRange({ from: "2026-10-31", to: "2026-10-31" });
  assert.equal(range.start.toISOString(), "2026-10-30T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-10-31T17:00:00.000Z");
  assert.equal(range.days, 1);
});

test("rejects impossible dates, malformed dates, reversed dates and overlarge windows", () => {
  for (const from of ["2026-02-29", "2026-04-31", "2026-1-01", "2026-10-31T00:00:00Z", "", "bad"]) {
    assert.ok(analyticsDateRange({ from, to: "2026-10-31" }).error, from);
  }
  assert.ok(analyticsDateRange({ from: "2026-11-01", to: "2026-10-31" }).error);
  assert.ok(analyticsDateRange({ from: "2024-01-01", to: "2026-10-31" }).error);
  assert.equal(analyticsDateRange({ from: "2024-01-01", to: "2024-12-31" }).error, null);
});

test("takes the first duplicate query parameter and accepts a leap day", () => {
  const range = analyticsDateRange({ from: ["2024-02-29", "bad"], to: "2024-02-29" });
  assert.equal(range.error, null);
  assert.equal(range.days, 1);
});
