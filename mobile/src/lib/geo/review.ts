import { clusterStays } from "./cluster";
import { getDb } from "../db";
import { putRow } from "../db/mutations";
import { uid, nowIso } from "../uid";

/** Nightly job: cluster a trip's raw points into stays, persist them, prune the
 * points. POI naming (reverse-geocode via an Edge Function) is a follow-up. */
export async function extractStays(tripId: string): Promise<number> {
  const db = await getDb();
  const pts = await db.getAllAsync<{ lat: number; lng: number; timestamp: string }>(
    "select lat, lng, timestamp from location_points where trip_id = ? order by timestamp",
    [tripId],
  );
  if (pts.length === 0) return 0;

  const stays = clusterStays(pts.map((p) => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })));
  const now = nowIso();
  for (const s of stays) {
    await putRow(db, "stays", {
      id: uid(),
      trip_id: tripId,
      lat: s.lat,
      lng: s.lng,
      arrived_at: s.arrivedAt,
      departed_at: s.departedAt,
      poi_name: null,
      poi_category: null,
      poi_place_id: null,
      review_status: "unreviewed",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }
  await db.runAsync("delete from location_points where trip_id = ?", [tripId]); // prune working data
  return stays.length;
}
