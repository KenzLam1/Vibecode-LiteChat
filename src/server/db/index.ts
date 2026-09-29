import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

// Opens a database and brings it up to the latest migration. Pass ":memory:"
// for a fresh throwaway database (tests).
export function createDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  // SQLite leaves foreign keys off by default; cascades depend on them.
  sqlite.pragma("foreign_keys = ON");
  if (file !== ":memory:") sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

// Survives dev-server hot reloads, so there is one connection per process.
const globalForDb = globalThis as unknown as { litechatDb?: Db };

export function getDb(): Db {
  if (!globalForDb.litechatDb) {
    const file = process.env.DATABASE_PATH;
    if (!file) throw new Error("Missing environment variable DATABASE_PATH");
    globalForDb.litechatDb = createDb(file);
  }
  return globalForDb.litechatDb;
}
