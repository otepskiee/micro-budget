// Ghost-split settlement. Everything is in HOME minor units (convert travel
// expenses first). `paid_by` fronted the whole expense; each split person owes
// their resolved share. Net = fronted - owed. Then minimise the transfers.
// Pure + tested (scripts/verify-logic.ts).

export type SettleExpense = {
  id: string;
  paidBy: string;
  homeMinor: number;
  splits: { personId: string; shareMinor: number }[];
};

export type Transfer = { from: string; to: string; amount: number };

/** Net balance per person: positive = others owe them, negative = they owe. */
export function computeBalances(
  expenses: SettleExpense[],
): Map<string, number> {
  const net = new Map<string, number>();
  const add = (p: string, v: number) => net.set(p, (net.get(p) ?? 0) + v);
  for (const e of expenses) {
    add(e.paidBy, e.homeMinor);
    for (const s of e.splits) add(s.personId, -s.shareMinor);
  }
  return net;
}

/** Greedy minimal settlement: fewest transfers that clear all balances. */
export function simplifyDebts(net: Map<string, number>): Transfer[] {
  const creditors: { p: string; v: number }[] = [];
  const debtors: { p: string; v: number }[] = [];
  for (const [p, v] of net) {
    if (v > 0) creditors.push({ p, v });
    else if (v < 0) debtors.push({ p, v: -v });
  }
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    if (amount > 0)
      transfers.push({ from: debtors[i].p, to: creditors[j].p, amount });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return transfers;
}
