import { getDb } from "./db";
import { putRow } from "./db/mutations";
import { supabase, isSupabaseConfigured } from "./supabase";

export type SyncResult = { count: number; error?: string };

// Composite-primary-key tables need an explicit conflict target on upsert.
const ONCONFLICT: Record<string, string> = {
  splits: "expense_id,person_id",
  trip_members: "trip_id,person_id",
};

// Pull: tables with an updated_at get an incremental fetch; child tables without
// one are small, so fetch them whole (RLS scopes to the user either way).
const PULL_INCREMENTAL = ["people", "trips", "accounts", "categories", "budgets", "receipts", "stays", "expenses", "transfers"];
const PULL_FULL = ["trip_members", "splits", "transfer_fees"];

/** Push the local outbox up to Supabase. No-ops unless configured AND signed in —
 * the app works fully with no account; this just backs it up once you log in. */
export async function flushOutbox(): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { count: 0, error: "Supabase not configured" };
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { count: 0, error: "Not signed in" };

  const db = await getDb();
  const items = await db.getAllAsync<{ id: number; entity: string; entity_id: string; op: string; payload: string }>(
    "select id, entity, entity_id, op, payload from outbox order by id asc limit 500",
  );

  let count = 0;
  for (const item of items) {
    try {
      if (item.op === "delete") {
        const { error } = await supabase.from(item.entity).delete().eq("id", item.entity_id);
        if (error) throw error;
      } else {
        const payload = { ...JSON.parse(item.payload), user_id: userId };
        const onConflict = ONCONFLICT[item.entity];
        const { error } = await supabase.from(item.entity).upsert(payload, onConflict ? { onConflict } : undefined);
        if (error) throw error;
      }
      await db.runAsync("delete from outbox where id = ?", [item.id]);
      count++;
    } catch (e) {
      return { count, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { count };
}

async function upsertLocal(
  db: Awaited<ReturnType<typeof getDb>>,
  table: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  let n = 0;
  for (const r of rows) {
    const clean: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "user_id") continue; // local schema has no user_id
      clean[k] = v === null || v === undefined ? null : typeof v === "object" ? JSON.stringify(v) : (v as string | number | boolean);
    }
    await putRow(db, table, clean, { sync: false }); // no echo back into the outbox
    n++;
  }
  return n;
}

/** Pull server changes into the local DB (last-write-wins via insert-or-replace). */
export async function pull(): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { count: 0, error: "Supabase not configured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { count: 0, error: "Not signed in" };

  const db = await getDb();
  const lastRow = await db.getFirstAsync<{ value: string }>("select value from sync_meta where key = 'last_sync'");
  const last = lastRow?.value ?? "1970-01-01T00:00:00.000Z";
  const startedAt = new Date().toISOString();

  let count = 0;
  try {
    for (const table of PULL_INCREMENTAL) {
      const { data: rows, error } = await supabase.from(table).select("*").gt("updated_at", last);
      if (error) throw error;
      count += await upsertLocal(db, table, (rows ?? []) as Record<string, unknown>[]);
    }
    for (const table of PULL_FULL) {
      const { data: rows, error } = await supabase.from(table).select("*");
      if (error) throw error;
      count += await upsertLocal(db, table, (rows ?? []) as Record<string, unknown>[]);
    }
    await db.runAsync("insert or replace into sync_meta (key, value) values ('last_sync', ?)", [startedAt]);
    return { count };
  } catch (e) {
    return { count, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Push local changes, then pull server changes. */
export async function fullSync(): Promise<{ pushed: number; pulled: number; error?: string }> {
  const push = await flushOutbox();
  if (push.error && push.error !== "Not signed in") return { pushed: push.count, pulled: 0, error: push.error };
  const pl = await pull();
  return { pushed: push.count, pulled: pl.count, error: pl.error };
}
