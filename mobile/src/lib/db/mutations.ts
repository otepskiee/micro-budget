import type { SQLiteDatabase } from "expo-sqlite";
import { getDb } from "./index";
import { uid, nowIso } from "../uid";
import { splitEvenly } from "../money";

// A row expressed with Supabase-friendly types (booleans as booleans). We store
// a SQLite-coerced copy locally and enqueue this shape for sync-on-login.
export type Row = Record<string, string | number | boolean | null>;

function toSqlite(v: string | number | boolean | null): string | number | null {
  if (typeof v === "boolean") return v ? 1 : 0;
  return v ?? null;
}

async function enqueue(db: SQLiteDatabase, entity: string, id: string, op: "upsert" | "delete", payload: Row) {
  await db.runAsync(
    "insert into outbox (entity, entity_id, op, payload, created_at) values (?,?,?,?,?)",
    [entity, id, op, JSON.stringify(payload), nowIso()],
  );
}

/** Write a row to local SQLite AND queue it for sync. `sync:false` for demo seed. */
export async function putRow(
  db: SQLiteDatabase,
  table: string,
  row: Row,
  opts: { sync?: boolean } = {},
): Promise<void> {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  await db.runAsync(
    `insert or replace into ${table} (${cols.join(", ")}) values (${placeholders})`,
    cols.map((c) => toSqlite(row[c])),
  );
  // Composite-key tables (splits, trip_members) have no single `id`; their sync
  // needs onConflict handling — deferred, so they write locally but don't enqueue.
  if (opts.sync !== false && row.id != null) await enqueue(db, table, String(row.id), "upsert", row);
}

export type NewExpense = {
  amountMinor: number;
  currency: string;
  categoryId?: string | null;
  tripId?: string | null;
  accountId?: string | null;
  paidBy?: string | null;
  note?: string | null;
  timestamp?: string;
  estimatedHomeMinor?: number | null;
  /** person ids to split equally with (including the payer). */
  splitWith?: string[];
};

/** Log an expense. Works in daily mode (no trip/account) or travel mode. */
export async function addExpense(e: NewExpense): Promise<string> {
  const db = await getDb();
  const id = uid();
  const ts = e.timestamp ?? nowIso();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await putRow(db, "expenses", {
      id,
      account_id: e.accountId ?? null,
      amount: e.amountMinor,
      currency: e.currency,
      category_id: e.categoryId ?? null,
      trip_id: e.tripId ?? null,
      paid_by: e.paidBy ?? null,
      timestamp: ts,
      note: e.note ?? null,
      settlement_status: "confirmed",
      estimated_home_amount: e.estimatedHomeMinor ?? null,
      created_at: now,
      updated_at: now,
    });
    if (e.splitWith && e.splitWith.length > 1) {
      const shares = splitEvenly(e.amountMinor, e.splitWith.length);
      for (let i = 0; i < e.splitWith.length; i++) {
        await putRow(db, "splits", {
          expense_id: id,
          person_id: e.splitWith[i],
          share_amount: shares[i],
        });
      }
    }
  });
  return id;
}

export async function getMeta(key: string, fallback: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("select value from sync_meta where key = ?", [key]);
  return row?.value ?? fallback;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("insert or replace into sync_meta (key, value) values (?, ?)", [key, value]);
}
