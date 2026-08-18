import { beforeEach, describe, expect, it } from "vitest";
import {
  getKeywordTrendData,
  importKeywordFile,
  keywordInternals,
  parseKeywordFile,
} from "./keywords";

describe("keyword offline import", () => {
  let latest: {
    rows: ReturnType<typeof parseKeywordFile>;
    importedAt: Date;
    filename: string | null;
    source: string;
  } | null;

  beforeEach(() => {
    latest = null;
    keywordInternals.usePersistenceForTest({
      loadLatest: async () => latest,
      save: async input => {
        latest = {
          rows: input.rows,
          importedAt: new Date("2026-08-18T08:00:00.000Z"),
          filename: input.filename,
          source: input.source,
        };
        return latest;
      },
    });
  });

  it("parses CSV with quoted values and normalizes CTR", () => {
    const rows = parseKeywordFile("csv", 'date,query,clicks,impressions,ctr,position,country,device\n2026-01-01,"mumsrelle, care",10,100,10,4.5,SG,MOBILE\n');
    expect(rows[0]).toMatchObject({ keyword: "mumsrelle, care", clicks: 10, impressions: 100, ctr: 0.1, position: 4.5, country: "SG", device: "MOBILE" });
  });

  it("parses JSON arrays and rejects invalid dates", () => {
    expect(parseKeywordFile("json", JSON.stringify([{ date: "2026-01-02", keyword: "seo dashboard", clicks: 2, impressions: 20, position: 8 }]))).toHaveLength(1);
    expect(() => parseKeywordFile("json", JSON.stringify([{ date: "02/01/2026", keyword: "bad" }]))).toThrow(/date must use/);
  });

  it("aggregates imported rows and applies dimensions", async () => {
    await importKeywordFile({ format: "csv", filename: "gsc-export.csv", content: 'date,keyword,clicks,impressions,position,country,device\n2026-01-01,alpha,10,100,5,SG,MOBILE\n2026-01-02,alpha,5,50,7,SG,DESKTOP\n2026-01-02,beta,20,200,3,MY,MOBILE\n' }, 1);
    const all = await getKeywordTrendData({ from: "2026-01-01", to: "2026-01-02" });
    expect(all.rowCount).toBe(3);
    expect(all.totals.clicks).toBe(35);
    expect(all.topKeywords[0]).toMatchObject({ keyword: "beta", clicks: 20 });
    expect((await getKeywordTrendData({ country: "SG" })).rowCount).toBe(2);
    expect((await getKeywordTrendData({ device: "DESKTOP" })).rowCount).toBe(1);
    expect(all.meta.filename).toBe("gsc-export.csv");
  });

  it("hydrates the latest valid import after a simulated restart", async () => {
    await importKeywordFile({ format: "json", filename: "trend.json", content: JSON.stringify([
      { date: "2026-01-01", keyword: "alpha", clicks: 10, impressions: 100, position: 8, source: "gsc" },
      { date: "2026-01-02", keyword: "alpha", clicks: 12, impressions: 120, position: 5, source: "gsc" },
    ]) }, 1);
    keywordInternals.reset();
    const restored = await getKeywordTrendData();
    expect(restored.meta.filename).toBe("trend.json");
    expect(restored.topKeywords[0]?.positionChange).toBe(3);
    expect(restored.rowCount).toBe(2);
  });

  it("calculates previous-versus-latest position from daily weighted values", async () => {
    await importKeywordFile({ format: "json", content: JSON.stringify([
      { date: "2026-01-01", keyword: "alpha", clicks: 1, impressions: 100, position: 10, country: "SG" },
      { date: "2026-01-01", keyword: "alpha", clicks: 1, impressions: 300, position: 6, country: "MY" },
      { date: "2026-01-02", keyword: "alpha", clicks: 1, impressions: 100, position: 4, country: "SG" },
    ]) }, 1);
    const result = await getKeywordTrendData();
    expect(result.topKeywords[0]?.positionChange).toBeCloseTo(3);
  });

  it("returns an explicit empty state before any verified import", async () => {
    const result = await getKeywordTrendData();
    expect(result.rowCount).toBe(0);
    expect(result.meta.importedAt).toBeNull();
    expect(result.trend).toEqual([]);
    expect(result.topKeywords).toEqual([]);
  });
});
