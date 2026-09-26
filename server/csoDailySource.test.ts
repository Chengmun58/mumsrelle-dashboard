import { describe, expect, it } from "vitest";
import { parseDailyCsv } from "./csoDailySource";

const header = "Date,No. of KIV Approach,Existing Customer Approach,No. of BA arranged,No. of New lead Sent,Promo8 rio version,Old Promo8,New Promo8,Pelvic Enhancement\n";

describe("CSO Daily Update source", () => {
  it("keeps blank distinct from zero and exposes source text instead of guessing", () => {
    const rows = parseDailyCsv(header + "9 Jul 2026,,0,2,76,,50,9,\n10 Jul 2026,\"Yihui: 128\",\"20 / 30\",2,29,,,,\n");
    expect(rows[0]).toMatchObject({ day: "2026-07-09", counts: { kivApproach: null, existingCustomerApproach: 0, baArranged: 2 } });
    expect(rows[1].counts.kivApproach).toBeNull();
    expect(rows[1].invalidCells).toEqual([
      { field: "kivApproach", raw: "Yihui: 128" },
      { field: "existingCustomerApproach", raw: "20 / 30" },
    ]);
  });

  it("fails closed when headings or dates make the source ambiguous", () => {
    expect(() => parseDailyCsv(header.replace("Date,", "Other,") + "9 Jul 2026,,,,,,,,\n")).toThrow(/headings/);
    expect(() => parseDailyCsv(header + "9 Jul 2026,,,,,,,,\n9 Jul 2026,,,,,,,,\n")).toThrow(/duplicate/);
  });
});
