import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type StoredKeywordRow = {
  date: string;
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  country: string;
  device: string;
  page: string;
  source: string;
};

/**
 * Immutable snapshots of verified keyword imports. Keeping each upload makes
 * the latest dataset durable across deploys while retaining an audit trail.
 */
export const keywordImports = mysqlTable("keyword_imports", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 255 }),
  source: varchar("source", { length: 100 }).notNull(),
  rowCount: int("rowCount").notNull(),
  rows: json("rows").$type<StoredKeywordRow[]>().notNull(),
  importedByUserId: int("importedByUserId").notNull(),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type KeywordImport = typeof keywordImports.$inferSelect;

export type CsoDailyCounts = {
  kivApproach: number | null;
  existingCustomerApproach: number | null;
  baArranged: number | null;
  newLeadSent: number | null;
  promo8RioVersion: number | null;
  oldPromo8: number | null;
  newPromo8: number | null;
  pelvicEnhancement: number | null;
};

/** Independent manual daily ledger; never writes to the source Casesheet. */
export const csoDailyUpdates = mysqlTable("cso_daily_updates", {
  day: varchar("day", { length: 10 }).primaryKey(),
  counts: json("counts").$type<CsoDailyCounts>().notNull(),
  updatedByUserId: int("updatedByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Every change to a daily entry is retained separately. */
export const csoDailyRevisions = mysqlTable("cso_daily_revisions", {
  id: int("id").autoincrement().primaryKey(),
  day: varchar("day", { length: 10 }).notNull(),
  before: json("before").$type<CsoDailyCounts | null>(),
  after: json("after").$type<CsoDailyCounts>().notNull(),
  changedByUserId: int("changedByUserId").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
