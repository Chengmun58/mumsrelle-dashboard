import { describe, expect, it } from "vitest";
import { periodDescription, rangeFor } from "./Home";

describe("dashboard date filters", () => {
  it("returns a seven-day range for This Week", () => {
    const [from, to] = rangeFor("This Week");
    expect(Math.round((to.getTime() - from.getTime()) / 86400000) + 1).toBe(7);
  });

  it("returns a complete prior month for Last Month", () => {
    const [from, to] = rangeFor("Last Month");
    expect(from.getDate()).toBe(1);
    expect(to.getMonth()).toBe(from.getMonth());
    expect(to.getDate()).toBe(new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate());
  });

  it("describes the selected period and comparison period", () => {
    expect(periodDescription("2025-12-01", "2025-12-31", "2025-11-01", "2025-11-30")).toContain("previous");
  });
});
