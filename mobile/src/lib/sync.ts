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
const PULL_INCREMENTAL = [
  "people",
  "trips",
  "accounts",
  "categories",
  "budgets",
  "receipts",
  "stays",
  "expenses",
  "transfers",
];
const PULL_FULL = ["trip_members", "splits", "transfer_fees"];

/** Push the local outbox up to Supabase. No-ops unless configured AND signed in —
 * the app works fully with no account; this just backs it up once you log in. */
export async function flushOutbox(): Promise<SyncResult> {
  if (!isSupabaseConfigured)
    return { count: 0, error: "Supabase not configured" };
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { count: 0, error: "Not signed in" };

  const db = await getDb();
  let count = 0;
  // Drain the whole outbox in batches — never leave rows behind, or a later pull()
  // could see local state the server hasn't caught up to.
  for (;;) {
    const items = await db.getAllAsync<{
      id: number;
      entity: string;
      entity_id: string;
      op: string;
      payload: string;
    }>(
      "select id, entity, entity_id, op, payload from outbox order by id asc limit 500",
    );
    if (items.length === 0) break;
    for (const item of items) {
      try {
        const onConflict = ONCONFLICT[item.entity];
        if (item.op === "delete") {
          // Composite-key tables have no `id` column — match on their key columns,
          // whose values are packed into entity_id as "a:b" (see mutations.putRow).
          let q = supabase.from(item.entity).delete();
          if (onConflict) {
            const cols = onConflict.split(",");
            const vals = item.entity_id.split(":");
            cols.forEach((c, i) => (q = q.eq(c, vals[i])));
          } else {
            q = q.eq("id", item.entity_id);
          }
          const { error } = await q;
          if (error) throw error;
        } else {
          const raw = JSON.parse(item.payload) as Record<string, unknown>;
          // parsed_json is TEXT locally but jsonb on the server — send it as an
          // object so it lands as structured JSON, not a quoted string scalar.
          if (typeof raw.parsed_json === "string") {
            try {
              raw.parsed_json = JSON.parse(raw.parsed_json);
            } catch {
              /* leave as-is if it isn't valid JSON */
            }
          }
          const payload = { ...raw, user_id: userId };
          const { error } = await supabase
            .from(item.entity)
            .upsert(payload, onConflict ? { onConflict } : undefined);
          if (error) throw error;
        }
        await db.runAsync("delete from outbox where id = ?", [item.id]);
        count++;
      } catch (e) {
        return { count, error: e instanceof Error ? e.message : String(e) };
      }
    }
    if (items.length < 500) break; // last (partial) batch drained
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
      clean[k] =
        v === null || v === undefined
          ? null
          : typeof v === "object"
            ? JSON.stringify(v)
            : (v as string | number | boolean);
    }
    await putRow(db, table, clean, { sync: false }); // no echo back into the outbox
    n++;
  }
  return n;
}

/** Pull server changes into the local DB (last-write-wins via insert-or-replace). */
export async function pull(): Promise<SyncResult> {
  if (!isSupabaseConfigured)
    return { count: 0, error: "Supabase not configured" };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { count: 0, error: "Not signed in" };

  const db = await getDb();
  const lastRow = await db.getFirstAsync<{ value: string }>(
    "select value from sync_meta where key = 'last_sync'",
  );
  const last = lastRow?.value ?? "1970-01-01T00:00:00.000Z";
  const startedAt = new Date().toISOString();

  let count = 0;
  try {
    for (const table of PULL_INCREMENTAL) {
      const { data: rows, error } = await supabase
        .from(table)
        .select("*")
        .gt("updated_at", last);
      if (error) throw error;
      count += await upsertLocal(
        db,
        table,
        (rows ?? []) as Record<string, unknown>[],
      );
    }
    for (const table of PULL_FULL) {
      const { data: rows, error } = await supabase.from(table).select("*");
      if (error) throw error;
      // Upsert only — never a wholesale `delete from <table>`. Local-only seed rows
      // (written sync:false, so absent from both the outbox and the server) and any
      // still-queued mutations would be wiped by a blind delete. Cross-device
      // deletion of these composite rows isn't propagated on pull yet; it needs a
      // tombstone/soft-delete log, which is deferred.
      count += await upsertLocal(
        db,
        table,
        (rows ?? []) as Record<string, unknown>[],
      );
    }
    await db.runAsync(
      "insert or replace into sync_meta (key, value) values ('last_sync', ?)",
      [startedAt],
    );
    return { count };
  } catch (e) {
    return { count, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Push local changes, then pull server changes. */
export async function fullSync(): Promise<{
  pushed: number;
  pulled: number;
  error?: string;
}> {
  const push = await flushOutbox();
  if (push.error && push.error !== "Not signed in")
    return { pushed: push.count, pulled: 0, error: push.error };
  const pl = await pull();
  return { pushed: push.count, pulled: pl.count, error: pl.error };
}
