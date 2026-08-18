import fs from "node:fs";
import path from "node:path";

const overview = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "server/data/overview-aggregate.json"), "utf8"),
) as {
  source: Record<string, unknown>;
  salesDaily: Record<string, number>;
  deptDaily: Record<string, Record<string, number>>;
};

const CSO_ID = "1NiQtjB-Xi8hfvvh5KoTEnWZe70Q0bws8kL649zVt4Ts";
const KIV_GID = "490960756";
const SIGNED_GID = "1012743586";
const CACHE_MS = 5 * 60 * 1000;

type CsvRow = string[];
type CsoSummary = {
  activeKiv: number;
  dueToday: number;
  overdue: number;
  newLeads: number;
  signedUp: number;
  topSources: Array<{ name: string; count: number }>;
  refreshedAt: string;
};

let csoCache: { expiresAt: number; key: string; value: CsoSummary } | null = null;

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) rows.push([...row, field.replace(/\r$/, "")]);
  return rows;
}

function rowsToObjects(rows: CsvRow[]) {
  const headers = rows[0] ?? [];
  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

function parseDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const date = new Date(`${raw} 00:00:00`);
  if (!raw || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function todayInSingapore() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchCsv(gid: string) {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${CSO_ID}/export?format=csv&gid=${gid}`);
  if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv")) throw new Error("Google Sheets CSV access unavailable");
  return parseCsv(await response.text());
}

async function getCsoSummary(from: string, to: string): Promise<CsoSummary> {
  const key = `${from}:${to}`;
  if (csoCache && csoCache.key === key && csoCache.expiresAt > Date.now()) return csoCache.value;
  const [kivRows, signedRows] = await Promise.all([fetchCsv(KIV_GID), fetchCsv(SIGNED_GID)]);
  const kiv = rowsToObjects(kivRows);
  const signed = rowsToObjects(signedRows);
  const today = todayInSingapore();
  const isKiv = (row: Record<string, string>) => row["Case Status"]?.trim().toLowerCase() === "kiv";
  const active = kiv.filter(isKiv);
  const inPeriod = (value: unknown) => {
    const date = parseDate(value);
    return Boolean(date && date >= from && date <= to);
  };
  const sourceCounts = new Map<string, number>();
  for (const row of active) {
    const source = row.Source?.trim() || "Unspecified";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const value: CsoSummary = {
    activeKiv: active.length,
    dueToday: active.filter(row => parseDate(row["KIV Date"]) === today).length,
    overdue: active.filter(row => {
      const date = parseDate(row["KIV Date"]);
      return Boolean(date && date < today);
    }).length,
    newLeads: active.filter(row => inPeriod(row["Call In Date"])).length,
    signedUp: signed.filter(row => row["Case Status"]?.trim().toLowerCase() === "signed up" && inPeriod(row["Call In Date"])).length,
    topSources: Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    refreshedAt: new Date().toISOString(),
  };
  csoCache = { expiresAt: Date.now() + CACHE_MS, key, value };
  return value;
}

function toIso(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function previousRange(from: string, to: string): [string, string] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  if (start.getDate() === 1 && end.getDate() === monthEnd.getDate() && start.getMonth() === end.getMonth()) {
    return [toIso(new Date(start.getFullYear(), start.getMonth() - 1, 1)), toIso(new Date(start.getFullYear(), start.getMonth(), 0))];
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  start.setDate(start.getDate() - days);
  end.setDate(end.getDate() - days);
  return [toIso(start), toIso(end)];
}

function sumRange(values: Record<string, number>, from: string, to: string) {
  return Object.entries(values).reduce((sum, [date, value]) => sum + (date >= from && date <= to ? Number(value) : 0), 0);
}

export async function getDashboardData(from: string, to: string) {
  const [previousFrom, previousTo] = previousRange(from, to);
  const current = sumRange(overview.salesDaily, from, to);
  const previous = sumRange(overview.salesDaily, previousFrom, previousTo);
  const availableDates = Object.keys(overview.salesDaily).sort();
  const months = new Map<string, number>();
  for (const [date, value] of Object.entries(overview.salesDaily)) months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + Number(value));
  const departments = { BODY: 0, "RETAIL PRODUCT": 0, FACE: 0 };
  for (const [date, values] of Object.entries(overview.deptDaily)) {
    if (date < from || date > to) continue;
    departments.BODY += Number(values.BODY ?? 0);
    departments["RETAIL PRODUCT"] += Number(values["RETAIL PRODUCT"] ?? 0);
    departments.FACE += Number(values.FACE ?? 0);
  }
  let cso: CsoSummary | null = null;
  let warning: string | null = null;
  try {
    cso = await getCsoSummary(from, to);
  } catch (error) {
    warning = error instanceof Error ? error.message : "CSO data unavailable";
  }
  return {
    range: { from, to, previousFrom, previousTo },
    sales: {
      current,
      previous,
      difference: current - previous,
      pop: previous ? ((current - previous) / previous) * 100 : null,
      outsideOverview: availableDates.length === 0 || to < availableDates[0] || from > availableDates[availableDates.length - 1],
    },
    trend: Array.from(months.entries()).sort().slice(-12).map(([month, value]) => ({ month, value })),
    departments,
    outlets: [{ name: "Mumsrelle MSOG", value: current }],
    outletDimensionAvailable: false,
    cso,
    warning,
    sources: {
      overview: { ...overview.source, latestDataDate: availableDates[availableDates.length - 1], firstDataDate: availableDates[0] },
      casesheet: { title: "Mumsrelle CSO Casesheet", tabs: ["KIV", "Signed Up"], cacheMinutes: 5 },
    },
  };
}

export const dashboardInternals = { previousRange, parseDate, CACHE_MS };
