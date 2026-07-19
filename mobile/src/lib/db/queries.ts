import { getDb } from "./index";
import { getMeta } from "./mutations";
import { computeBalances, simplifyDebts, type SettleExpense } from "../split/settle";
import { splitEvenly } from "../money";

export type CatRow = {
  id: string;
  name: string;
  spent: number;
  limit: number;
  state: "ok" | "warn" | "over";
};
export type ExpenseRow = {
  id: string;
  timestamp: string;
  note: string | null;
  categoryName: string | null;
  amount: number;
  currency: string;
};
export type TodaySummary = {
  homeCurrency: string;
  monthLabel: string;
  budgetMinor: number;
  spentMinor: number;
  safeTodayMinor: number;
  categories: CatRow[];
  today: ExpenseRow[];
};

const MONTH = "strftime('%Y-%m', timestamp) = strftime('%Y-%m','now','localtime')";

/** The daily budgeter view — works with no account and no trip. */
export async function getTodaySummary(): Promise<TodaySummary> {
  const db = await getDb();
  const homeCurrency = await getMeta("home_currency", "PHP");

  const spent = await db.getFirstAsync<{ s: number }>(
    `select coalesce(sum(amount),0) as s from expenses
     where deleted_at is null and trip_id is null and ${MONTH}`,
  );
  const budget = await db.getFirstAsync<{ b: number }>(
    "select coalesce(sum(amount),0) as b from budgets where deleted_at is null and cycle = 'monthly'",
  );
  const spentMinor = spent?.s ?? 0;
  const budgetMinor = budget?.b ?? 0;

  const cats = await db.getAllAsync<{ id: string; name: string; limit: number; spent: number }>(
    `select c.id, c.name, coalesce(b.amount,0) as "limit",
       coalesce((select sum(e.amount) from expenses e
         where e.category_id = c.id and e.deleted_at is null and e.trip_id is null
         and strftime('%Y-%m', e.timestamp) = strftime('%Y-%m','now','localtime')),0) as spent
     from categories c
     left join budgets b on b.category_id = c.id and b.cycle = 'monthly' and b.deleted_at is null
     where c.deleted_at is null
     order by "limit" desc, c.name`,
  );
  const categories: CatRow[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    spent: c.spent,
    limit: c.limit,
    state: c.limit > 0 && c.spent > c.limit ? "over" : c.limit > 0 && c.spent >= c.limit * 0.85 ? "warn" : "ok",
  }));

  const today = await db.getAllAsync<ExpenseRow>(
    `select e.id, e.timestamp, e.note, e.amount as amount, e.currency, c.name as categoryName
     from expenses e left join categories c on c.id = e.category_id
     where e.deleted_at is null and e.trip_id is null and date(e.timestamp) = date('now','localtime')
     order by e.timestamp desc`,
  );

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const safeTodayMinor = Math.max(0, Math.floor((budgetMinor - spentMinor) / daysLeft));
  const monthLabel = now.toLocaleString("en-US", { month: "long" }).toUpperCase();

  return { homeCurrency, monthLabel, budgetMinor, spentMinor, safeTodayMinor, categories, today };
}

export type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  home_currency: string;
  status: string;
};

export async function getTrips(): Promise<Trip[]> {
  const db = await getDb();
  return db.getAllAsync<Trip>(
    `select id, name, start_date, end_date, home_currency, status
     from trips where deleted_at is null order by coalesce(start_date,'') desc`,
  );
}

export async function getTripExpenses(tripId: string): Promise<ExpenseRow[]> {
  const db = await getDb();
  return db.getAllAsync<ExpenseRow>(
    `select e.id, e.timestamp, e.note, e.amount as amount, e.currency, c.name as categoryName
     from expenses e left join categories c on c.id = e.category_id
     where e.trip_id = ? and e.deleted_at is null order by e.timestamp`,
    [tripId],
  );
}

export async function pendingSyncCount(): Promise<number> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>("select count(*) as n from outbox");
  return r?.n ?? 0;
}

export type ReviewStay = {
  id: string;
  poi_name: string | null;
  arrived_at: string | null;
  review_status: string;
  expense?: { id: string; note: string | null; amount: number; currency: string };
};

/** The signature Nightly Review: the day's stops, each matched to an expense or
 * left as a gap ("you stopped here — spend anything?"). */
export async function getTripReview(tripId: string): Promise<ReviewStay[]> {
  const db = await getDb();
  const stays = await db.getAllAsync<{
    id: string;
    poi_name: string | null;
    arrived_at: string | null;
    review_status: string;
  }>(
    "select id, poi_name, arrived_at, review_status from stays where trip_id = ? and deleted_at is null order by arrived_at",
    [tripId],
  );
  const out: ReviewStay[] = [];
  for (const s of stays) {
    const e = await db.getFirstAsync<{ id: string; note: string | null; amount: number; currency: string }>(
      "select id, note, amount, currency from expenses where stay_id = ? and deleted_at is null limit 1",
      [s.id],
    );
    out.push({ ...s, expense: e ?? undefined });
  }
  return out;
}

export type Settlement = {
  homeCurrency: string;
  fronted: { id: string; name: string; minor: number }[];
  transfers: { fromName: string; toName: string; amount: number }[];
  items: { note: string | null; payerName: string; homeMinor: number }[];
};

/** Ghost-split settlement for a trip. Shared expenses split equally among the
 * trip members, netted at each payer's home-currency estimate. */
export async function getSettlement(tripId: string): Promise<Settlement> {
  const db = await getDb();
  const homeCurrency = await getMeta("home_currency", "PHP");
  const members = await db.getAllAsync<{ id: string; name: string }>(
    "select p.id, p.name from trip_members tm join people p on p.id = tm.person_id where tm.trip_id = ?",
    [tripId],
  );
  const rows = await db.getAllAsync<{
    id: string;
    note: string | null;
    amount: number;
    paid_by: string | null;
    est: number | null;
  }>(
    "select id, note, amount, paid_by, estimated_home_amount as est from expenses where trip_id = ? and deleted_at is null",
    [tripId],
  );
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.name ?? "You";

  const settleExpenses: SettleExpense[] = [];
  const items: Settlement["items"] = [];
  for (const r of rows) {
    if (!r.paid_by || members.length === 0) continue;
    const homeMinor = r.est ?? r.amount; // est is home currency; fall back to raw
    const shares = splitEvenly(homeMinor, members.length);
    settleExpenses.push({
      id: r.id,
      paidBy: r.paid_by,
      homeMinor,
      splits: members.map((m, i) => ({ personId: m.id, shareMinor: shares[i] })),
    });
    items.push({ note: r.note, payerName: nameOf(r.paid_by), homeMinor });
  }

  const net = computeBalances(settleExpenses);
  const fronted = members.map((m) => ({
    id: m.id,
    name: m.name,
    minor: settleExpenses.filter((e) => e.paidBy === m.id).reduce((s, e) => s + e.homeMinor, 0),
  }));
  const transfers = simplifyDebts(net).map((t) => ({
    fromName: nameOf(t.from),
    toName: nameOf(t.to),
    amount: t.amount,
  }));
  return { homeCurrency, fronted, transfers, items };
}

export async function getCategories(): Promise<{ id: string; name: string }[]> {
  const db = await getDb();
  return db.getAllAsync<{ id: string; name: string }>(
    "select id, name from categories where deleted_at is null order by name",
  );
}
