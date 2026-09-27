import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";

type OverviewData = {
  source: Record<string, unknown>;
  salesDaily: Record<string, number>;
  deptDaily: Record<string, Record<string, number>>;
};

const bundledOverview = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "server/data/overview-aggregate.json"), "utf8"),
) as OverviewData;

const CACHE_MS = 5 * 60 * 1000;
type CsvRow = string[];
type CsoLoader = () => Promise<[string[][], string[][]]>;
type CsoSummary = {
  activeKiv: number;
  dueToday: number;
  overdue: number;
  newLeads: number;
  signedUp: number;
  signedUpDateMissing: number;
  topSources: Array<{ name: string; count: number }>;
  refreshedAt: string;
};

let csoRowsCache: {
  expiresAt: number;
  rows: [string[][], string[][]];
  refreshedAt: string;
} | null = null;
let overviewCache: { expiresAt: number; value: OverviewData } | null = null;

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") {
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
    Object.fromEntries(headers.map((header, index) => [header.trim(), row[index]?.trim() ?? ""])),
  );
}

function rowValue(row: Record<string, string>, names: string[]) {
  const normalized = new Set(names.map(name => name.trim().toLowerCase()));
  const entry = Object.entries(row).find(([key]) => normalized.has(key.trim().toLowerCase()));
  return entry?.[1]?.trim() ?? "";
}

function parseDate(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function todayInSingapore() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchCsv(sheetId: string, gid: string) {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Google Sheets HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv")) throw new Error("Google Sheets CSV access unavailable");
  return parseCsv(await response.text());
}

async function defaultCsoLoader(): Promise<[string[][], string[][]]> {
  if (!ENV.csoSheetId || !ENV.csoKivGid || !ENV.csoSignedGid) {
    throw new Error("CSO Google Sheets source is not configured");
  }
  return Promise.all([
    fetchCsv(ENV.csoSheetId, ENV.csoKivGid),
    fetchCsv(ENV.csoSheetId, ENV.csoSignedGid),
  ]);
}

async function loadCsoRows(loader: CsoLoader) {
  if (csoRowsCache && csoRowsCache.expiresAt > Date.now()) return csoRowsCache;
  const rows = await loader();
  csoRowsCache = {
    expiresAt: Date.now() + CACHE_MS,
    rows,
    refreshedAt: new Date().toISOString(),
  };
  return csoRowsCache;
}

function leadKey(row: Record<string, string>, index: number) {
  const contact = rowValue(row, ["Contact No.", "Contact No", "Mobile", "Phone"]).replace(/\D/g, "");
  if (contact) return `phone:${contact}`;
  const email = rowValue(row, ["Email Address", "Email"]).toLowerCase();
  if (email) return `email:${email}`;
  const name = rowValue(row, ["Name", "Customer Name"]).toLowerCase();
  const callInDate = parseDate(rowValue(row, ["Call In Date"]));
  return name ? `name:${name}:${callInDate ?? ""}` : `row:${index}`;
}

function signedUpDate(row: Record<string, string>) {
  const explicitDate = parseDate(rowValue(row, ["Signed Up Date"]));
  if (explicitDate) return explicitDate;
  // A service status date is signup evidence only when that service is signed up.
  if (rowValue(row, ["SC Status"]).toLowerCase() === "su package") {
    return parseDate(rowValue(row, ["SC Status Date"]));
  }
  return null;
}

async function getCsoSummary(
  from: string,
  to: string,
  loader: CsoLoader = defaultCsoLoader,
): Promise<CsoSummary> {
  const cached = await loadCsoRows(loader);
  const [kivRows, signedRows] = cached.rows;
  const kiv = rowsToObjects(kivRows);
  const signed = rowsToObjects(signedRows);
  const today = todayInSingapore();
  const isKiv = (row: Record<string, string>) => rowValue(row, ["Case Status"]).toLowerCase() === "kiv";
  const isSigned = (row: Record<string, string>) => rowValue(row, ["Case Status"]).toLowerCase() === "signed up";
  const active = kiv.filter(isKiv);
  const inPeriod = (date: string | null) => Boolean(date && date >= from && date <= to);
  const sourceCounts = new Map<string, number>();

  for (const row of active) {
    const source = rowValue(row, ["Source"]) || "Unspecified";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  const periodLeads = [...kiv, ...signed]
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => inPeriod(parseDate(rowValue(row, ["Call In Date"]))));
  const uniqueLeadKeys = new Set(periodLeads.map(({ row, index }) => leadKey(row, index)));

  return {
    activeKiv: active.length,
    dueToday: active.filter(row => parseDate(rowValue(row, ["KIV Date"])) === today).length,
    overdue: active.filter(row => {
      const date = parseDate(rowValue(row, ["KIV Date"]));
      return Boolean(date && date < today);
    }).length,
    newLeads: uniqueLeadKeys.size,
    signedUp: signed.filter(row => isSigned(row) && inPeriod(signedUpDate(row))).length,
    signedUpDateMissing: signed.filter(row => isSigned(row) && !signedUpDate(row)).length,
    topSources: Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    refreshedAt: cached.refreshedAt,
  };
}

function isOverviewData(value: unknown): value is OverviewData {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.salesDaily && typeof record.salesDaily === "object" && record.deptDaily && typeof record.deptDaily === "object");
}

async function loadOverview(): Promise<{ value: OverviewData; warning: string | null; mode: "live" | "bundled" | "stale" }> {
  if (!ENV.salesOverviewUrl) {
    return {
      value: bundledOverview,
      warning: "Live sales source is not configured; showing the bundled snapshot.",
      mode: "bundled",
    };
  }
  if (overviewCache && overviewCache.expiresAt > Date.now()) {
    return { value: overviewCache.value, warning: null, mode: "live" };
  }
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (ENV.salesOverviewToken) headers.Authorization = `Bearer ${ENV.salesOverviewToken}`;
    const response = await fetch(ENV.salesOverviewUrl, { headers, signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`Sales source HTTP ${response.status}`);
    const value = await response.json();
    if (!isOverviewData(value)) throw new Error("Sales source returned an invalid overview payload");
    overviewCache = { value, expiresAt: Date.now() + CACHE_MS };
    return { value, warning: null, mode: "live" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sales source unavailable";
    if (overviewCache) return { value: overviewCache.value, warning: `${message}; showing the last successful live snapshot.`, mode: "stale" };
    return { value: bundledOverview, warning: `${message}; showing the bundled snapshot.`, mode: "bundled" };
  }
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
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  start.setDate(start.getDate() - days);
  end.setDate(end.getDate() - days);
  return [toIso(start), toIso(end)];
}

function sumRange(values: Record<string, number>, from: string, to: string) {
  return Object.entries(values).reduce(
    (sum, [date, value]) => sum + (date >= from && date <= to ? Number(value) : 0),
    0,
  );
}

async function loadCsoSafely(from: string, to: string, loader?: CsoLoader) {
  try {
    const cso = await getCsoSummary(from, to, loader);
    return {
      cso,
      warning: cso.signedUpDateMissing
        ? `${cso.signedUpDateMissing} current signed-up records have no supported signup date and are excluded from period signup totals.`
        : null,
    };
  } catch (error) {
    return { cso: null, warning: error instanceof Error ? error.message : "CSO data unavailable" };
  }
}

export async function getDashboardData(from: string, to: string) {
  const [overviewResult, csoResult] = await Promise.all([loadOverview(), loadCsoSafely(from, to)]);
  const overview = overviewResult.value;
  const [previousFrom, previousTo] = previousRange(from, to);
  const current = sumRange(overview.salesDaily, from, to);
  const previous = sumRange(overview.salesDaily, previousFrom, previousTo);
  const availableDates = Object.keys(overview.salesDaily).sort();
  const months = new Map<string, number>();
  for (const [date, value] of Object.entries(overview.salesDaily)) {
    months.set(date.slice(0, 7), (months.get(date.slice(0, 7)) ?? 0) + Number(value));
  }
  const departments = { BODY: 0, "RETAIL PRODUCT": 0, FACE: 0 };
  for (const [date, values] of Object.entries(overview.deptDaily)) {
    if (date < from || date > to) continue;
    departments.BODY += Number(values.BODY ?? 0);
    departments["RETAIL PRODUCT"] += Number(values["RETAIL PRODUCT"] ?? 0);
    departments.FACE += Number(values.FACE ?? 0);
  }

  const warnings = [overviewResult.warning, csoResult.warning].filter(Boolean);
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
    cso: csoResult.cso,
    warning: warnings.length ? warnings.join(" ") : null,
    sources: {
      overview: {
        ...overview.source,
        mode: overviewResult.mode,
        latestDataDate: availableDates.at(-1),
        firstDataDate: availableDates[0],
      },
      casesheet: { title: "Mumsrelle CSO Casesheet", tabs: ["KIV", "Signed Up"], cacheMinutes: 5 },
    },
  };
}

export const dashboardInternals = {
  previousRange,
  parseDate,
  sumRange,
  CACHE_MS,
  cacheWindow: () => ({ durationMs: CACHE_MS, durationMinutes: CACHE_MS / 60_000 }),
  outsideOverview: (from: string, to: string, dates: string[]) => dates.length === 0 || to < dates[0] || from > dates[dates.length - 1],
  resetCsoCache: () => { csoRowsCache = null; },
  resetOverviewCache: () => { overviewCache = null; },
  getCsoSummaryForTest: getCsoSummary,
  loadCsoSafelyForTest: loadCsoSafely,
};
