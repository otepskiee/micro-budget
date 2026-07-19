// Foreign-cash pool cost basis. A pool is topped up by money-changer / ATM moves,
// each with a foreign amount and what it cost in home currency. The effective
// rate is the WEIGHTED AVERAGE (explainable in one sentence; FIFO isn't).
// Rates are home-minor per foreign-minor, so draws convert straight to home minor.
// Pure + tested (scripts/verify-logic.ts).

export type PoolTopup = { foreignMinor: number; homeMinor: number };

/** Weighted-average home-minor per foreign-minor. 0 if the pool is empty. */
export function poolEffectiveRate(topups: PoolTopup[]): number {
  const f = topups.reduce((s, t) => s + t.foreignMinor, 0);
  const h = topups.reduce((s, t) => s + t.homeMinor, 0);
  return f === 0 ? 0 : h / f;
}

/** Home-minor cost of drawing `foreignMinor` from the pool at its effective rate. */
export function poolDrawHome(
  foreignMinor: number,
  homeMinorPerForeignMinor: number,
): number {
  return Math.round(foreignMinor * homeMinorPerForeignMinor);
}
