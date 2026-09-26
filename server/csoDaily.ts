import { and, desc, eq, gte, lte } from "drizzle-orm";
import { csoDailyRevisions, csoDailyUpdates, type CsoDailyCounts } from "../drizzle/schema";
import { getDb } from "./db";

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
  return db.select().from(csoDailyUpdates)
    .where(and(gte(csoDailyUpdates.day, from), lte(csoDailyUpdates.day, to)))
    .orderBy(desc(csoDailyUpdates.day));
}

export async function saveCsoDaily(day: string, counts: CsoDailyCounts, userId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [previous] = await tx.select().from(csoDailyUpdates)
      .where(eq(csoDailyUpdates.day, day)).limit(1);
    if (previous?.counts && JSON.stringify(previous.counts) === JSON.stringify(counts)) return previous;
    await tx.insert(csoDailyUpdates).values({ day, counts, updatedByUserId: userId })
      .onDuplicateKeyUpdate({ set: { counts, updatedByUserId: userId, updatedAt: new Date() } });
    await tx.insert(csoDailyRevisions).values({
      day,
      before: previous?.counts ?? null,
      after: counts,
      changedByUserId: userId,
    });
    const [saved] = await tx.select().from(csoDailyUpdates).where(eq(csoDailyUpdates.day, day)).limit(1);
    return saved;
  });
}
