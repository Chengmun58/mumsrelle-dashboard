import { defineConfig } from "drizzle-kit";

// DATABASE_URL is only needed for commands that connect to the database
// (e.g. `migrate`, `push`). `generate` only diffs the schema against the
// migrations folder, so the config must still load without it.
const connectionString = process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
