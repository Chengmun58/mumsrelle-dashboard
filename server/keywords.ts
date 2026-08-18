import { z } from "zod";

export const keywordRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  keyword: z.string().min(1).max(500),
  clicks: z.number().finite().nonnegative(),
  impressions: z.number().finite().nonnegative(),
  ctr: z.number().finite().nonnegative(),
  position: z.number().finite().nonnegative(),
  country: z.string().default("ALL"),
  device: z.string().default("ALL"),
  page: z.string().default(""),
  source: z.string().default("offline-import"),
});

export type KeywordRow = z.infer<typeof keywordRowSchema>;
export type KeywordFilters = {
  from?: string;
  to?: string;
  keyword?: string;
  country?: string;
  device?: string;
  page?: string;
  source?: string;
};

type KeywordStore = {
  rows: KeywordRow[];
  importedAt: string | null;
  filename: string | null;
  source: string;
};

const store: KeywordStore = { rows: [], importedAt: null, filename: null, source: "offline-import" };
const MAX_ROWS = 20000;

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/[%,$]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function valueOf(record: Record<string, unknown>, names: string[]) {
  const entry = Object.entries(record).find(([key]) => names.includes(key.trim().toLowerCase()));
  return entry?.[1];
}

function normalizeRecord(record: Record<string, unknown>, index: number): KeywordRow {
  const date = String(valueOf(record, ["date", "day", "date range"]) ?? "").slice(0, 10);
  const keyword = String(valueOf(record, ["keyword", "query", "search query", "term"]) ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Row ${index + 1}: date must use YYYY-MM-DD`);
  if (!keyword) throw new Error(`Row ${index + 1}: keyword is required`);
  const impressions = parseNumber(valueOf(record, ["impressions", "impression"]));
  const clicks = parseNumber(valueOf(record, ["clicks", "click"]));
  const rawCtr = parseNumber(valueOf(record, ["ctr", "click through rate"]));
  return keywordRowSchema.parse({
    date,
    keyword,
    clicks,
    impressions,
    ctr: rawCtr > 1 ? rawCtr / 100 : rawCtr || (impressions ? clicks / impressions : 0),
    position: parseNumber(valueOf(record, ["position", "average position", "rank"])),
    country: String(valueOf(record, ["country", "region"]) ?? "ALL").trim() || "ALL",
    device: String(valueOf(record, ["device"]) ?? "ALL").trim() || "ALL",
    page: String(valueOf(record, ["page", "url", "landing page"]) ?? "").trim(),
    source: String(valueOf(record, ["source", "provider"]) ?? "offline-import").trim() || "offline-import",
  });
}

export function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim()); cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function parseKeywordFile(format: "csv" | "json", content: string) {
  let records: Record<string, unknown>[];
  if (format === "csv") records = parseCsv(content);
  else {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) throw new Error("JSON must contain an array of keyword rows");
    records = parsed.filter(value => value && typeof value === "object") as Record<string, unknown>[];
  }
  if (!records.length) throw new Error("The imported file contains no keyword rows");
  if (records.length > MAX_ROWS) throw new Error(`The imported file exceeds the ${MAX_ROWS.toLocaleString()} row limit`);
  return records.map(normalizeRecord);
}

export function importKeywordFile(input: { format: "csv" | "json"; content: string; filename?: string; source?: string }) {
  const rows = parseKeywordFile(input.format, input.content).map(row => ({ ...row, source: input.source?.trim() || row.source }));
  store.rows = rows;
  store.importedAt = new Date().toISOString();
  store.filename = input.filename?.trim() || null;
  store.source = input.source?.trim() || "offline-import";
  return getKeywordMeta();
}

function filterRows(filters: KeywordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  return store.rows.filter(row => (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to) && (!keyword || row.keyword.toLowerCase().includes(keyword)) && (!filters.country || filters.country === "ALL" || row.country === filters.country) && (!filters.device || filters.device === "ALL" || row.device === filters.device) && (!filters.page || filters.page === "ALL" || row.page === filters.page) && (!filters.source || filters.source === "ALL" || row.source === filters.source));
}

function getKeywordMeta() {
  const rows = store.rows;
  const dates = rows.map(row => row.date).sort();
  return { rowCount: rows.length, importedAt: store.importedAt, filename: store.filename, source: store.source, firstDate: dates[0] ?? null, latestDate: dates.at(-1) ?? null };
}

export function getKeywordOptions() {
  return { keywords: Array.from(new Set(store.rows.map(row => row.keyword))).sort(), countries: Array.from(new Set(store.rows.map(row => row.country))).sort(), devices: Array.from(new Set(store.rows.map(row => row.device))).sort(), pages: Array.from(new Set(store.rows.map(row => row.page).filter(Boolean))).sort(), sources: Array.from(new Set(store.rows.map(row => row.source))).sort() };
}

export function getKeywordTrendData(filters: KeywordFilters = {}) {
  const rows = filterRows(filters);
  const byDate = new Map<string, { clicks: number; impressions: number; positionWeighted: number; positionWeight: number }>();
  const byKeyword = new Map<string, { clicks: number; impressions: number; positionWeighted: number; positionWeight: number; latestPosition: number; previousPosition: number | null; latestDate: string }>();
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const date = byDate.get(row.date) ?? { clicks: 0, impressions: 0, positionWeighted: 0, positionWeight: 0 };
    date.clicks += row.clicks; date.impressions += row.impressions; date.positionWeighted += row.position * Math.max(row.impressions, 1); date.positionWeight += Math.max(row.impressions, 1); byDate.set(row.date, date);
    const keyword = byKeyword.get(row.keyword) ?? { clicks: 0, impressions: 0, positionWeighted: 0, positionWeight: 0, latestPosition: row.position, previousPosition: null, latestDate: row.date };
    keyword.clicks += row.clicks; keyword.impressions += row.impressions; keyword.positionWeighted += row.position * Math.max(row.impressions, 1); keyword.positionWeight += Math.max(row.impressions, 1);
    if (row.date > keyword.latestDate) { keyword.previousPosition = keyword.latestPosition; keyword.latestPosition = row.position; keyword.latestDate = row.date; }
    byKeyword.set(row.keyword, keyword);
  }
  const trend = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, clicks: value.clicks, impressions: value.impressions, ctr: value.impressions ? value.clicks / value.impressions : 0, position: value.positionWeight ? value.positionWeighted / value.positionWeight : 0 }));
  const topKeywords = Array.from(byKeyword.entries()).sort(([, a], [, b]) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 20).map(([keyword, value]) => ({ keyword, clicks: value.clicks, impressions: value.impressions, ctr: value.impressions ? value.clicks / value.impressions : 0, position: value.positionWeight ? value.positionWeighted / value.positionWeight : 0, positionChange: value.previousPosition === null ? null : value.previousPosition - value.latestPosition }));
  const totals = trend.reduce((result, row) => ({ clicks: result.clicks + row.clicks, impressions: result.impressions + row.impressions, positionWeighted: result.positionWeighted + row.position * Math.max(row.impressions, 1), positionWeight: result.positionWeight + Math.max(row.impressions, 1) }), { clicks: 0, impressions: 0, positionWeighted: 0, positionWeight: 0 });
  return { meta: getKeywordMeta(), filters, rowCount: rows.length, totals: { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions : 0, position: totals.positionWeight ? totals.positionWeighted / totals.positionWeight : 0 }, trend, topKeywords, options: getKeywordOptions() };
}

export const keywordInternals = { parseCsv, parseKeywordFile, getKeywordMeta, filterRows, reset: () => { store.rows = []; store.importedAt = null; store.filename = null; store.source = "offline-import"; } };
