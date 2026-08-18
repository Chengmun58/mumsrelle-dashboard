import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  keywordImports,
  StoredKeywordRow,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required for authenticated and persistent dashboard data");
  }
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] === undefined) continue;
    const normalized = user[field] ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type KeywordImportRecord = {
  rows: StoredKeywordRow[];
  importedAt: Date;
  filename: string | null;
  source: string;
};

export async function saveKeywordImport(input: {
  rows: StoredKeywordRow[];
  filename: string | null;
  source: string;
  importedByUserId: number;
}): Promise<KeywordImportRecord> {
  const db = await requireDb();
  const importedAt = new Date();
  await db.insert(keywordImports).values({
    rows: input.rows,
    filename: input.filename,
    source: input.source,
    rowCount: input.rows.length,
    importedByUserId: input.importedByUserId,
    importedAt,
  });
  return { rows: input.rows, filename: input.filename, source: input.source, importedAt };
}

export async function getLatestKeywordImport(): Promise<KeywordImportRecord | null> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(keywordImports)
    .orderBy(desc(keywordImports.importedAt), desc(keywordImports.id))
    .limit(1);
  const latest = result[0];
  if (!latest) return null;
  return {
    rows: latest.rows,
    filename: latest.filename,
    source: latest.source,
    importedAt: latest.importedAt,
  };
}
