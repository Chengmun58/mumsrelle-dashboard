import { and, desc, eq, gte, lte } from "drizzle-orm";
import { csoDailyRevisions, csoDailyUpdates, type CsoDailyCounts } from "../drizzle/schema";
import { getDb } from "./db";
import { readDailySource } from "./csoDailySource";

export const csoDailyFields = [
  { key: "kivApproach", label: "No. of KIV Approach" },
  { key: "existingCustomerApproach", label: "Existing Customer Approach" },
  { key: "baArranged", label: "No. of BA arranged" },
  { key: "newLeadSent", label: "No. of New lead Sent" },
  { key: "promo8RioVersion", label: "Promo8 rio version" },
  { key: "oldPromo8", label: "Old Promo8" },
  { key: "newPromo8", label: "New Promo8" },
  { key: "pelvicEnhancement", label: "Pelvic Enhancement" },
] as const;

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required for CSO daily updates");
  return db;
}

export async function listCsoDaily(from: string, to: string) {
  const db = await requireDb();
  const saved = await db.select().from(csoDailyUpdates)
    .where(and(gte(csoDailyUpdates.day, from), lte(csoDailyUpdates.day, to)))
    .orderBy(desc(csoDailyUpdates.day));
  let warning: string | null = null;
  let sourceFetchedAt: string | null = null;
  const rows = new Map<string, {
    day: string;
    counts: CsoDailyCounts;
    updatedAt: Date | null;
    origin: "sheet" | "manual";
    invalidCells: Array<{ field: keyof CsoDailyCounts; raw: string }>;
  }>();
  try {
    const source = await readDailySource();
    sourceFetchedAt = source.fetchedAt;
    for (const row of source.rows) {
      if (row.day >= from && row.day <= to) rows.set(row.day, { ...row, origin: "sheet", updatedAt: null });
    }
  } catch (error) {
    warning = error instanceof Error ? error.message : "CSO Daily Update source unavailable";
  }
  for (const row of saved) {
    rows.set(row.day, { day: row.day, counts: row.counts, updatedAt: row.updatedAt, origin: "manual", invalidCells: [] });
  }
  return { entries: Array.from(rows.values()).sort((a,b) => b.day.localeCompare(a.day)), sourceFetchedAt, warning };
}

export async function saveCsoDaily(day: string, counts: CsoDailyCounts, userId: number) {
  const db = await requireDb();
  // Do not silently hide an existing source date if the source cannot be checked.
  const source = await readDailySource();
  const sourceBefore = source.rows.find(row => row.day === day)?.counts ?? null;
  return db.transaction(async tx => {
    const [previous] = await tx.select().from(csoDailyUpdates)
      .where(eq(csoDailyUpdates.day, day)).limit(1);
    if (previous?.counts && JSON.stringify(previous.counts) === JSON.stringify(counts)) return previous;
    await tx.insert(csoDailyUpdates).values({ day, counts, updatedByUserId: userId })
      .onDuplicateKeyUpdate({ set: { counts, updatedByUserId: userId, updatedAt: new Date() } });
    await tx.insert(csoDailyRevisions).values({
      day,
      before: previous?.counts ?? sourceBefore,
      after: counts,
      changedByUserId: userId,
    });
    const [saved] = await tx.select().from(csoDailyUpdates).where(eq(csoDailyUpdates.day, day)).limit(1);
    return saved;
  });
}
