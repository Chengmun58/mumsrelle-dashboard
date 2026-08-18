import { describe, expect, it, vi } from "vitest";
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

  it("summarizes daily sales only inside the requested range", () => {
    expect(dashboardInternals.sumRange({ "2025-12-01": 100, "2025-12-15": 25, "2026-01-01": 999 }, "2025-12-01", "2025-12-31")).toBe(125);
  });

  it("keeps the CSO cache at exactly five minutes and exposes the cache window", () => {
    expect(dashboardInternals.CACHE_MS).toBe(5 * 60 * 1000);
    expect(dashboardInternals.cacheWindow()).toEqual({ durationMs: 300000, durationMinutes: 5 });
  });

  it("flags periods outside the Overview snapshot", () => {
    expect(dashboardInternals.outsideOverview("2024-01-01", "2024-01-31", ["2025-01-01", "2025-12-31"])).toBe(true);
    expect(dashboardInternals.outsideOverview("2025-12-01", "2025-12-31", ["2025-01-01", "2025-12-31"])).toBe(false);
  });

  it("hits the CSO cache within five minutes and reloads after expiry", async () => {
    vi.useFakeTimers();
    dashboardInternals.resetCsoCache();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return [[
        ["Case Status", "KIV Date", "Call In Date", "Source"],
        ["KIV", "18/08/2026", "18/08/2026", "Referral"],
      ], [["Case Status", "Call In Date"], ["Signed Up", "18/08/2026"]]];
    };
    await dashboardInternals.getCsoSummaryForTest("2026-08-18", "2026-08-18", loader);
    await dashboardInternals.getCsoSummaryForTest("2026-08-18", "2026-08-18", loader);
    expect(calls).toBe(1);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await dashboardInternals.getCsoSummaryForTest("2026-08-18", "2026-08-18", loader);
    expect(calls).toBe(2);
    vi.useRealTimers();
  });

  it("returns a warning instead of throwing when CSO loading fails", async () => {
    dashboardInternals.resetCsoCache();
    const result = await dashboardInternals.loadCsoSafelyForTest("2026-08-18", "2026-08-18", async () => {
      throw new Error("Google Sheets unavailable");
    });
    expect(result.cso).toBeNull();
    expect(result.warning).toBe("Google Sheets unavailable");
  });
});
