import fs from "node:fs";
import path from "node:path";

export type CustomerReportData = {
  source: {
    title: string;
    recordSource: string;
    driveUpdatedAt: string;
    snapshotAt: string;
    privacy: string;
  };
  totals: {
    records: number;
    activeKiv: number;
    signedUp: number;
    declined: number;
    waitingList: number;
    signedRate: number;
    signedShareOfOpenAndWon: number;
  };
  statusBreakdown: Array<{ name: string; count: number }>;
  topSources: Array<{ name: string; count: number }>;
  serviceCategories: Array<{ name: string; count: number }>;
  prhbStatus: Array<{ name: string; count: number }>;
  scStatus: Array<{ name: string; count: number }>;
  appointmentStatus: Array<{ name: string; count: number }>;
  declineReasons: Array<{ name: string; count: number }>;
  monthlyActivity: Array<{
    month: string;
    lastContact: number;
    prhbActivity: number;
    scActivity: number;
    appointments: number;
    signedUpActivity: number;
    kivActivity: number;
  }>;
  quality: {
    futureDatedFields: Record<string, number>;
    appointmentSpellingVariant: number;
    notes: string[];
  };
};

const report = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "server/data/cso-report-aggregate.json"),
    "utf8"
  )
) as CustomerReportData;

export function getCustomerReportData() {
  return report;
}
