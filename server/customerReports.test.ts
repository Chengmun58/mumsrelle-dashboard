import { describe, expect, it } from "vitest";
import { getCustomerReportData } from "./customerReports";

describe("customer report aggregate", () => {
  it("matches the status totals from the reporting mirror", () => {
    const report = getCustomerReportData();
    expect(report.totals.records).toBe(15_281);
    expect(report.totals.activeKiv).toBe(2_473);
    expect(report.totals.signedUp).toBe(661);
  });

  it("contains aggregated fields only", () => {
    const report = getCustomerReportData() as unknown as Record<
      string,
      unknown
    >;
    expect(report).not.toHaveProperty("customers");
    expect(report).not.toHaveProperty("contacts");
    expect(report).not.toHaveProperty("rows");
    expect(report.source).not.toHaveProperty("spreadsheetId");
  });
});
