import { describe, expect, it } from "vitest";
import { dashboardInternals } from "./dashboard";

describe("dashboard calculations", () => {
  it("uses the prior calendar month for a full-month selection", () => {
    expect(dashboardInternals.previousRange("2025-12-01", "2025-12-31")).toEqual(["2025-11-01", "2025-11-30"]);
  });

  it("uses an equal-length preceding range for custom periods", () => {
    expect(dashboardInternals.previousRange("2026-08-10", "2026-08-12")).toEqual(["2026-08-07", "2026-08-09"]);
  });

  it("normalizes Singapore-style dates", () => {
    expect(dashboardInternals.parseDate("18/08/2026")).toBe("2026-08-18");
    expect(dashboardInternals.parseDate("not-a-date")).toBeNull();
  });

  it("keeps the CSO cache at exactly five minutes", () => {
    expect(dashboardInternals.CACHE_MS).toBe(5 * 60 * 1000);
  });
});
