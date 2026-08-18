import { describe, expect, it } from "vitest";
import { buildKeywordFilters, detectKeywordFileFormat, percent } from "./KeywordTrends";

describe("KeywordTrends page helpers", () => {
  it("detects upload format without inventing content", () => {
    expect(detectKeywordFileFormat("gsc-export.JSON")).toBe("json");
    expect(detectKeywordFileFormat("gsc-export.csv")).toBe("csv");
  });

  it("builds filters with optional keyword and explicit source", () => {
    expect(buildKeywordFilters({ from: "2026-01-01", to: "2026-01-31", keyword: "", country: "SG", device: "MOBILE", page: "ALL", source: "gsc-export.csv" })).toEqual({ from: "2026-01-01", to: "2026-01-31", keyword: undefined, country: "SG", device: "MOBILE", page: "ALL", source: "gsc-export.csv" });
  });

  it("formats CTR for empty and non-empty states", () => {
    expect(percent(0)).toBe("0.00%");
    expect(percent(0.125)).toBe("12.50%");
  });
});
