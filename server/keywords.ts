import { z } from "zod";
import {
  getLatestKeywordImport,
  saveKeywordImport,
  type KeywordImportRecord,
} from "./db";

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
  storageWarning: string | null;
};

type KeywordPersistence = {
  loadLatest: () => Promise<KeywordImportRecord | null>;
  save: (input: {
    rows: KeywordRow[];
    filename: string | null;
    source: string;
    importedByUserId: number;
  }) => Promise<KeywordImportRecord>;
};

const databasePersistence: KeywordPersistence = {
  loadLatest: getLatestKeywordImport,
  save: saveKeywordImport,
};

const emptyStore = (): KeywordStore => ({
  rows: [],
  importedAt: null,
  filename: null,
  source: "offline-import",
  storageWarning: null,
});

let store = emptyStore();
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
let persistence: KeywordPersistence = databasePersistence;
const MAX_ROWS = 20_000;

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

function applyRecord(record: KeywordImportRecord | null) {
  if (!record) return;
  store = {
    rows: record.rows.map(row => keywordRowSchema.parse(row)),
    importedAt: record.importedAt.toISOString(),
    filename: record.filename,
    source: record.source,
    storageWarning: null,
  };
}

async function ensureHydrated() {
  if (hydrated) return;
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      try {
        applyRecord(await persistence.loadLatest());
      } catch (error) {
        store.storageWarning = error instanceof Error ? error.message : "Keyword storage unavailable";
      } finally {
        hydrated = true;
        hydrationPromise = null;
      }
    })();
  }
  await hydrationPromise;
}

export async function importKeywordFile(
  input: { format: "csv" | "json"; content: string; filename?: string; source?: string },
  importedByUserId: number,
) {
  const rows = parseKeywordFile(input.format, input.content).map(row => ({
    ...row,
    source: input.source?.trim() || row.source,
  }));
  const rowSources = Array.from(new Set(rows.map(row => row.source)));
  const snapshotSource = input.source?.trim() || (rowSources.length === 1 ? rowSources[0] : "mixed-import");
  const record = await persistence.save({
    rows,
    filename: input.filename?.trim() || null,
    source: snapshotSource,
    importedByUserId,
  });
  applyRecord(record);
  hydrated = true;
  return getKeywordMeta();
}

function filterRows(filters: KeywordFilters) {
  const keyword = filters.keyword?.trim().toLowerCase();
  return store.rows.filter(row =>
    (!filters.from || row.date >= filters.from) &&
    (!filters.to || row.date <= filters.to) &&
    (!keyword || row.keyword.toLowerCase().includes(keyword)) &&
    (!filters.country || filters.country === "ALL" || row.country === filters.country) &&
    (!filters.device || filters.device === "ALL" || row.device === filters.device) &&
    (!filters.page || filters.page === "ALL" || row.page === filters.page) &&
    (!filters.source || filters.source === "ALL" || row.source === filters.source)
  );
}

function getKeywordMeta() {
  const dates = store.rows.map(row => row.date).sort();
  return {
    rowCount: store.rows.length,
    importedAt: store.importedAt,
    filename: store.filename,
    source: store.source,
    firstDate: dates[0] ?? null,
    latestDate: dates.at(-1) ?? null,
    storage: "database" as const,
    warning: store.storageWarning,
  };
}

function getKeywordOptions() {
  return {
    keywords: Array.from(new Set(store.rows.map(row => row.keyword))).sort(),
    countries: Array.from(new Set(store.rows.map(row => row.country))).sort(),
    devices: Array.from(new Set(store.rows.map(row => row.device))).sort(),
    pages: Array.from(new Set(store.rows.map(row => row.page).filter(Boolean))).sort(),
    sources: Array.from(new Set(store.rows.map(row => row.source))).sort(),
  };
}

export async function getKeywordTrendData(filters: KeywordFilters = {}) {
  await ensureHydrated();
  const rows = filterRows(filters);
  const byDate = new Map<string, { clicks: number; impressions: number; positionWeighted: number; positionWeight: number }>();
  const byKeyword = new Map<string, {
    clicks: number;
    impressions: number;
    positionWeighted: number;
    positionWeight: number;
    dailyPositions: Map<string, { weighted: number; weight: number }>;
  }>();

  for (const row of rows) {
    const weight = Math.max(row.impressions, 1);
    const date = byDate.get(row.date) ?? { clicks: 0, impressions: 0, positionWeighted: 0, positionWeight: 0 };
    date.clicks += row.clicks;
    date.impressions += row.impressions;
    date.positionWeighted += row.position * weight;
    date.positionWeight += weight;
    byDate.set(row.date, date);

    const keyword = byKeyword.get(row.keyword) ?? {
      clicks: 0,
      impressions: 0,
      positionWeighted: 0,
      positionWeight: 0,
      dailyPositions: new Map(),
    };
    keyword.clicks += row.clicks;
    keyword.impressions += row.impressions;
    keyword.positionWeighted += row.position * weight;
    keyword.positionWeight += weight;
    const daily = keyword.dailyPositions.get(row.date) ?? { weighted: 0, weight: 0 };
    daily.weighted += row.position * weight;
    daily.weight += weight;
    keyword.dailyPositions.set(row.date, daily);
    byKeyword.set(row.keyword, keyword);
  }

  const trend = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      clicks: value.clicks,
      impressions: value.impressions,
      ctr: value.impressions ? value.clicks / value.impressions : 0,
      position: value.positionWeight ? value.positionWeighted / value.positionWeight : 0,
    }));

  const topKeywords = Array.from(byKeyword.entries())
    .sort(([, a], [, b]) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 20)
    .map(([keyword, value]) => {
      const positions = Array.from(value.dailyPositions.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, daily]) => daily.weighted / daily.weight);
      const latest = positions.at(-1) ?? null;
      const previous = positions.at(-2) ?? null;
      return {
        keyword,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr: value.impressions ? value.clicks / value.impressions : 0,
        position: value.positionWeight ? value.positionWeighted / value.positionWeight : 0,
        positionChange: latest === null || previous === null ? null : previous - latest,
      };
    });

  const totals = trend.reduce(
    (result, row) => ({
      clicks: result.clicks + row.clicks,
      impressions: result.impressions + row.impressions,
      positionWeighted: result.positionWeighted + row.position * Math.max(row.impressions, 1),
      positionWeight: result.positionWeight + Math.max(row.impressions, 1),
    }),
    { clicks: 0, impressions: 0, positionWeighted: 0, positionWeight: 0 },
  );

  return {
    meta: getKeywordMeta(),
    filters,
    rowCount: rows.length,
    totals: {
      clicks: totals.clicks,
      impressions: totals.impressions,
      ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
      position: totals.positionWeight ? totals.positionWeighted / totals.positionWeight : 0,
    },
    trend,
    topKeywords,
    options: getKeywordOptions(),
  };
}

export const keywordInternals = {
  parseCsv,
  parseKeywordFile,
  getKeywordMeta,
  filterRows,
  reset: () => {
    store = emptyStore();
    hydrated = false;
    hydrationPromise = null;
  },
  usePersistenceForTest: (testPersistence: KeywordPersistence) => {
    persistence = testPersistence;
    store = emptyStore();
    hydrated = false;
    hydrationPromise = null;
  },
  restoreDatabasePersistence: () => {
    persistence = databasePersistence;
    store = emptyStore();
    hydrated = false;
    hydrationPromise = null;
  },
};
