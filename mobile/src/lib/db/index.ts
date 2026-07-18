import * as SQLite from "expo-sqlite";
import { MIGRATIONS } from "./schema";
import { nowIso } from "../uid";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Opens (once) and migrates the local database. Source of truth on device. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = openAndMigrate();
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("microbudget.db");
  await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  await db.execAsync(
    "create table if not exists _migrations (name text primary key, applied_at text not null);",
  );
  const rows = await db.getAllAsync<{ name: string }>("select name from _migrations");
  const applied = new Set(rows.map((r) => r.name));
  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync("insert into _migrations (name, applied_at) values (?, ?)", [m.name, nowIso()]);
    });
  }
  return db;
}
