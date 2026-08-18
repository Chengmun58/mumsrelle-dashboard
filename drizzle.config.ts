import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against existing migration
// snapshots and never opens a connection, so a placeholder keeps config
// loading working in environments (like CI) where DATABASE_URL isn't set.
// Commands that do connect (migrate, push, studio) still require the real
// DATABASE_URL to be set.
const connectionString = process.env.DATABASE_URL ?? "mysql://placeholder:placeholder@localhost:3306/placeholder";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
