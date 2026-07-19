import { getDb } from "./index";
import { putRow, setMeta } from "./mutations";
import { uid, nowIso } from "../uid";

// Demo starter data (sync:false — local only, not pushed). Reproduces the design's
// daily numbers relative to the device's current month, so the Today screen is live.
export async function seedIfEmpty(): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ n: number }>("select count(*) as n from categories");
  if ((existing?.n ?? 0) > 0) return;

  await setMeta("home_currency", "PHP");
  const now = nowIso();
  const me = uid();
  const yana = uid();
  const S = { sync: false } as const;

  await putRow(db, "people", { id: me, name: "You", avatar_emoji: null, is_me: true, created_at: now, updated_at: now, deleted_at: null }, S);
  await putRow(db, "people", { id: yana, name: "Yana", avatar_emoji: null, is_me: false, created_at: now, updated_at: now, deleted_at: null }, S);

  // categories + monthly budgets (PHP, 2-decimal minor units)
  const cats: [string, number][] = [["Food", 800000], ["Transport", 350000], ["Home", 450000], ["Fun", 800000]];
  const catId: Record<string, string> = {};
  for (const [name, limit] of cats) {
    const id = uid();
    catId[name] = id;
    await putRow(db, "categories", { id, name, icon: null, parent_id: null, created_at: now, updated_at: now, deleted_at: null }, S);
    await putRow(db, "budgets", { id: uid(), category_id: id, amount: limit, currency: "PHP", cycle: "monthly", created_at: now, updated_at: now, deleted_at: null }, S);
  }

  const d = new Date();
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 9, 0, 0).toISOString();
  const todayAt = (h: number, m: number) => {
    const x = new Date();
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const daily = async (minor: number, cat: string, note: string, ts: string) =>
    putRow(db, "expenses", {
      id: uid(), account_id: null, amount: minor, currency: "PHP", category_id: catId[cat],
      trip_id: null, paid_by: me, timestamp: ts, note, settlement_status: "confirmed",
      estimated_home_amount: null, actual_home_amount: null, receipt_id: null, stay_id: null,
      created_at: now, updated_at: now, deleted_at: null,
    }, S);

  // earlier this month
  await daily(651000, "Food", "Groceries", startOfMonth);
  await daily(290000, "Transport", "Commute pass", startOfMonth);
  await daily(460000, "Home", "Rent share", startOfMonth); // over its 4,500 limit
  await daily(216000, "Fun", "Movies", startOfMonth);
  // today
  await daily(14500, "Food", "Kape", todayAt(8, 10));
  await daily(22000, "Transport", "Grab to office", todayAt(8, 40));
  await daily(18500, "Food", "Lunch · Jollibee", todayAt(12, 30));

  // a small travel trip so the Trips tab has content (multi-currency)
  const trip = uid();
  await putRow(db, "trips", { id: trip, name: "Hanoi", start_date: null, end_date: null, home_currency: "PHP", location_tracking_enabled: false, status: "active", created_at: now, updated_at: now, deleted_at: null }, S);
  await putRow(db, "trip_members", { trip_id: trip, person_id: me }, S);
  await putRow(db, "trip_members", { trip_id: trip, person_id: yana }, S);
  // the day's stops (dwells) — two matched to expenses, two left as gaps
  const at = (h: number, m: number) => {
    const x = new Date();
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const stay = async (poi: string, h: number, m: number, status: string) => {
    const id = uid();
    await putRow(db, "stays", {
      id, trip_id: trip, lat: null, lng: null, arrived_at: at(h, m), departed_at: null,
      poi_name: poi, poi_category: null, poi_place_id: null, review_status: status,
      created_at: now, updated_at: now, deleted_at: null,
    }, S);
    return id;
  };
  const travAt = async (minor: number, note: string, estPhp: number, stayId: string, h: number, m: number) =>
    putRow(db, "expenses", {
      id: uid(), account_id: null, amount: minor, currency: "VND", category_id: catId["Food"],
      trip_id: trip, paid_by: me, timestamp: at(h, m), note, settlement_status: "confirmed",
      estimated_home_amount: estPhp, actual_home_amount: null, receipt_id: null, stay_id: stayId,
      created_at: now, updated_at: now, deleted_at: null,
    }, S);

  await stay("The Chi Boutique", 8, 32, "no_spend");
  const sCafe = await stay("Cộng Càphê", 9, 24, "matched");
  await travAt(90000, "Egg coffee ×2", 20000, sCafe, 9, 24); // VND 90,000 ≈ PHP 200
  await stay("Hoàn Kiếm Lake", 10, 41, "unreviewed"); // GAP
  const sLunch = await stay("Bún Chả Hương Liên", 12, 15, "matched");
  await travAt(220000, "Bún Chả lunch", 48889, sLunch, 12, 15);
  await stay("Đồng Xuân Market", 14, 5, "unreviewed"); // GAP
}
