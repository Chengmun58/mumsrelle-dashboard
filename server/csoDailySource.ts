import { ENV } from "./_core/env";
import type { CsoDailyCounts } from "../drizzle/schema";

export type SourceEntry = {
  day: string;
  counts: CsoDailyCounts;
  invalidCells: Array<{ field: keyof CsoDailyCounts; raw: string }>;
};

const columns: Array<keyof CsoDailyCounts> = [
  "kivApproach", "existingCustomerApproach", "baArranged", "newLeadSent",
  "promo8RioVersion", "oldPromo8", "newPromo8", "pelvicEnhancement",
];
const expectedHeaders = [
  "Date", "No. of KIV Approach", "Existing Customer Approach", "No. of BA arranged",
  "No. of New lead Sent", "Promo8 rio version", "Old Promo8", "New Promo8", "Pelvic Enhancement",
];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let cache: { rows: SourceEntry[]; expiresAt: number; fetchedAt: string } | null = null;

function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ""; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (row.length || cell) rows.push([...row, cell.replace(/\r$/, "")]);
  return rows;
}

function parseDay(raw: string) {
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
  if (!m) return null;
  const month = months.findIndex(x => x.toLowerCase() === m[2].toLowerCase()) + 1;
  if (!month || +m[1] < 1 || +m[1] > 31) return null;
  const iso = `${m[3]}-${String(month).padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === iso ? iso : null;
}

export function parseDailyCsv(text: string): SourceEntry[] {
  const rows = csvRows(text.replace(/^\ufeff/, ""));
  if (!expectedHeaders.every((h, i) => rows[0]?.[i]?.trim() === h)) {
    throw new Error("CSO Daily Update column headings have changed");
  }
  const output: SourceEntry[] = []; const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    if (!row.some(v => v?.trim())) continue;
    const day = parseDay(row[0] ?? "");
    if (!day) throw new Error("CSO Daily Update has an invalid or missing date");
    if (seen.has(day)) throw new Error(`CSO Daily Update has duplicate date ${day}`);
    seen.add(day);
    const counts = {} as CsoDailyCounts;
    const invalidCells: SourceEntry["invalidCells"] = [];
    columns.forEach((field, i) => {
      const raw = row[i + 1]?.trim() ?? "";
      if (!raw) counts[field] = null;
      else if (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))) counts[field] = Number(raw);
      else { counts[field] = null; invalidCells.push({ field, raw }); }
    });
    output.push({ day, counts, invalidCells });
  }
  return output;
}

export async function readDailySource() {
  if (cache && cache.expiresAt > Date.now()) return cache;
  if (!ENV.csoSheetId || !ENV.csoDailyGid) throw new Error("CSO_DAILY_GID or CSO_SHEET_ID is not configured");
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(ENV.csoSheetId)}/export?format=csv&gid=${encodeURIComponent(ENV.csoDailyGid)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`CSO Daily Update source HTTP ${response.status}`);
  if (!(response.headers.get("content-type") ?? "").includes("text/csv")) throw new Error("CSO Daily Update CSV access unavailable");
  const rows = parseDailyCsv(await response.text());
  cache = { rows, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + 5 * 60_000 };
  return cache;
}
