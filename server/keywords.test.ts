import { describe, expect, it, beforeEach } from "vitest";
import { getKeywordTrendData, importKeywordFile, keywordInternals, parseCsv, parseKeywordFile } from "./keywords";

describe("keyword offline import", () => {
  beforeEach(() => keywordInternals.reset());

  it("parses CSV with quoted values and normalizes CTR", () => {
    const rows = parseKeywordFile("csv", 'date,query,clicks,impressions,ctr,position,country,device\n2026-01-01,"mumsrelle, care",10,100,10,4.5,SG,MOBILE\n');
    expect(rows[0]).toMatchObject({ keyword: "mumsrelle, care", clicks: 10, impressions: 100, ctr: 0.1, position: 4.5, country: "SG", device: "MOBILE" });
  });

  it("parses JSON arrays and rejects invalid dates", () => {
    expect(parseKeywordFile("json", JSON.stringify([{ date: "2026-01-02", keyword: "seo dashboard", clicks: 2, impressions: 20, position: 8 }]))).toHaveLength(1);
    expect(() => parseKeywordFile("json", JSON.stringify([{ date: "02/01/2026", keyword: "bad" }]))).toThrow(/date must use/);
  });

  it("aggregates imported rows and applies dimensions", () => {
    importKeywordFile({ format: "csv", filename: "gsc-export.csv", content: 'date,keyword,clicks,impressions,position,country,device\n2026-01-01,alpha,10,100,5,SG,MOBILE\n2026-01-02,alpha,5,50,7,SG,DESKTOP\n2026-01-02,beta,20,200,3,MY,MOBILE\n' });
    const all = getKeywordTrendData({ from: "2026-01-01", to: "2026-01-02" });
    expect(all.rowCount).toBe(3);
    expect(all.totals.clicks).toBe(35);
    expect(all.topKeywords[0]).toMatchObject({ keyword: "beta", clicks: 20 });
    expect(getKeywordTrendData({ country: "SG" }).rowCount).toBe(2);
    expect(getKeywordTrendData({ device: "DESKTOP" }).rowCount).toBe(1);
    expect(all.meta.filename).toBe("gsc-export.csv");
  });

  it("preserves the latest valid import across repeated refresh reads", () => {
    importKeywordFile({ format: "json", filename: "trend.json", content: JSON.stringify([
      { date: "2026-01-01", keyword: "alpha", clicks: 10, impressions: 100, position: 8, source: "gsc" },
      { date: "2026-01-02", keyword: "alpha", clicks: 12, impressions: 120, position: 5, source: "gsc" },
    ]) });
    const first = getKeywordTrendData();
    const refreshed = getKeywordTrendData();
    expect(refreshed.meta.filename).toBe("trend.json");
    expect(refreshed.meta.importedAt).toBe(first.meta.importedAt);
    expect(refreshed.topKeywords[0]?.positionChange).toBe(3);
    expect(refreshed.rowCount).toBe(2);
  });

  it("returns an explicit empty state before any verified import", () => {
    const result = getKeywordTrendData();
    expect(result.rowCount).toBe(0);
    expect(result.meta.importedAt).toBeNull();
    expect(result.trend).toEqual([]);
    expect(result.topKeywords).toEqual([]);
  });
});
