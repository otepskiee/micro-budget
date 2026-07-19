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

async function enqueue(
  db: SQLiteDatabase,
  entity: string,
  id: string,
  op: "upsert" | "delete",
  payload: Row,
) {
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
  if (opts.sync !== false) {
    // Composite-key tables (splits, trip_members) get a composite entity id; the
    // sync push upserts them with the right onConflict target.
    const entityId =
      row.id != null
        ? String(row.id)
        : row.expense_id != null && row.person_id != null
          ? `${row.expense_id}:${row.person_id}`
          : row.trip_id != null && row.person_id != null
            ? `${row.trip_id}:${row.person_id}`
            : JSON.stringify(row);
    await enqueue(db, table, entityId, "upsert", row);
  }
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
  receiptId?: string | null;
  stayId?: string | null;
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
      receipt_id: e.receiptId ?? null,
      stay_id: e.stayId ?? null,
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

export async function addReceipt(r: {
  imageLocalPath?: string | null;
  parsedJson?: string | null;
  parseMethod?: "mlkit" | "ai" | "manual";
  status?: "unprocessed" | "parsed" | "matched";
}): Promise<string> {
  const db = await getDb();
  const id = uid();
  const now = nowIso();
  await putRow(db, "receipts", {
    id,
    image_local_path: r.imageLocalPath ?? null,
    image_remote_path: null,
    ocr_raw_text: null,
    parsed_json: r.parsedJson ?? null,
    parse_method: r.parseMethod ?? "manual",
    status: r.status ?? "unprocessed",
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return id;
}

/** Money changer / ATM: derive the effective rate from gave-X-got-Y and open a
 * foreign-cash pool with that cost basis. (Each change opens a pool; topping up
 * an existing pool with a weighted-average basis is a follow-up.) */
export async function addPoolFromChange(c: {
  tripId: string | null;
  gaveMinor: number;
  gaveCurrency: string;
  gotMinor: number;
  gotCurrency: string;
}): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const costBasis = c.gotMinor === 0 ? 0 : c.gaveMinor / c.gotMinor; // home-minor per foreign-minor
  const acc = uid();
  await db.withTransactionAsync(async () => {
    await putRow(db, "accounts", {
      id: acc,
      name: `${c.gotCurrency} pool`,
      currency: c.gotCurrency,
      type: "pool",
      cost_basis_rate: costBasis,
      trip_id: c.tripId,
      archived_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    await putRow(db, "transfers", {
      id: uid(),
      from_account_id: null,
      to_account_id: acc,
      from_amount: c.gaveMinor,
      from_currency: c.gaveCurrency,
      to_amount: c.gotMinor,
      to_currency: c.gotCurrency,
      timestamp: now,
      source: "changer",
      settlement_status: "confirmed",
      note: "Money changer",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // Backfill: any earlier trip expense in this currency that had no home estimate
    // (logged before a rate existed) now gets one from this cost basis. This is the
    // product's core promise — you learn what that VND spend cost in home money the
    // moment you change cash. Re-put each row (full columns) so the update also
    // enqueues for sync. Without a trip we can't scope safely, so skip.
    if (c.tripId) {
      const pending = await db.getAllAsync<Row>(
        "select * from expenses where trip_id = ? and currency = ? and estimated_home_amount is null and deleted_at is null",
        [c.tripId, c.gotCurrency],
      );
      for (const row of pending) {
        const est = Math.round(Number(row.amount) * costBasis);
        await putRow(db, "expenses", {
          ...row,
          estimated_home_amount: est,
          updated_at: now,
        });
      }
    }
  });
}

export async function addPerson(name: string): Promise<string> {
  const db = await getDb();
  const id = uid();
  const now = nowIso();
  await putRow(db, "people", {
    id,
    name,
    avatar_emoji: null,
    is_me: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
  return id;
}

export async function addTripMember(
  tripId: string,
  personId: string,
): Promise<void> {
  const db = await getDb();
  await putRow(db, "trip_members", { trip_id: tripId, person_id: personId });
}

export async function addTrip(t: {
  name: string;
  homeCurrency: string;
}): Promise<string> {
  const db = await getDb();
  const id = uid();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await putRow(db, "trips", {
      id,
      name: t.name,
      start_date: null,
      end_date: null,
      home_currency: t.homeCurrency,
      location_tracking_enabled: false,
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    const me = await db.getFirstAsync<{ id: string }>(
      "select id from people where is_me = 1 limit 1",
    );
    if (me) await putRow(db, "trip_members", { trip_id: id, person_id: me.id });
  });
  return id;
}

export async function addLocationPoint(p: {
  tripId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  timestamp: string;
}): Promise<void> {
  const db = await getDb();
  // Raw GPS is working data — not synced; pruned after stays are extracted.
  await db.runAsync(
    "insert into location_points (id, trip_id, lat, lng, accuracy, timestamp) values (?,?,?,?,?,?)",
    [uid(), p.tripId, p.lat, p.lng, p.accuracy, p.timestamp],
  );
}

export async function updateStayReview(
  stayId: string,
  status: "unreviewed" | "no_spend" | "matched",
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "update stays set review_status = ?, updated_at = ? where id = ?",
    [status, nowIso(), stayId],
  );
}

export async function getMeta(key: string, fallback: string): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "select value from sync_meta where key = ?",
    [key],
  );
  return row?.value ?? fallback;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "insert or replace into sync_meta (key, value) values (?, ?)",
    [key, value],
  );
}
