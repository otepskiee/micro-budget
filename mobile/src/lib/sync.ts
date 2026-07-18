import { getDb } from "./db";
import { supabase, isSupabaseConfigured } from "./supabase";

export type SyncResult = { pushed: number; error?: string };

/** Push the local outbox up to Supabase. No-ops unless configured AND signed in —
 * the whole app works with no account; this just backs it up once you log in.
 * Pull/merge (server -> local) is the next step (LWW on updated_at). */
export async function flushOutbox(): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { pushed: 0, error: "Supabase not configured" };
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return { pushed: 0, error: "Not signed in" };

  const db = await getDb();
  const items = await db.getAllAsync<{
    id: number;
    entity: string;
    entity_id: string;
    op: string;
    payload: string;
  }>("select id, entity, entity_id, op, payload from outbox order by id asc limit 500");

  let pushed = 0;
  for (const item of items) {
    try {
      if (item.op === "delete") {
        const { error } = await supabase.from(item.entity).delete().eq("id", item.entity_id);
        if (error) throw error;
      } else {
        const payload = { ...JSON.parse(item.payload), user_id: userId };
        const { error } = await supabase.from(item.entity).upsert(payload);
        if (error) throw error;
      }
      await db.runAsync("delete from outbox where id = ?", [item.id]);
      pushed++;
    } catch (e) {
      return { pushed, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { pushed };
}
