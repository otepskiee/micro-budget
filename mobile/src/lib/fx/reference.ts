// Default FX source — the fallback the app reaches for ONLY when it has no rate
// the user actually realized. Micro Budget's whole thesis is "never ask for a
// rate — derive it from what you gave and got"; a money-changer pool's cost basis
// always wins. But when you haven't changed money yet, a foreign amount still
// needs *some* home value (for the settlement and the log-time preview), so we
// fall back to these approximate market rates rather than showing nothing.
//
// These are ballpark figures anchored to USD, not live rates — clearly labelled
// "reference" in the UI. A live refresh (cache the latest into sync_meta, prefer
// it over this table) is a straightforward follow-up; the resolution order
// (pool → live → this table) already leaves room for it.
import { decimals } from "../currencies";

/** Human-readable snapshot label shown next to any reference-derived figure. */
export const RATES_AS_OF = "early 2026";

// Units of each currency per 1 USD. Approximate. Extend freely — anything absent
// simply has no reference and the UI treats it as "rate pending" instead.
const PER_USD: Record<string, number> = {
  USD: 1,
  PHP: 58,
  VND: 25400,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155,
  KRW: 1380,
  CNY: 7.2,
  HKD: 7.8,
  TWD: 32,
  THB: 36,
  SGD: 1.35,
  MYR: 4.7,
  IDR: 16200,
  INR: 84,
  AUD: 1.5,
  NZD: 1.65,
  CAD: 1.37,
  CHF: 0.9,
  AED: 3.67,
  SAR: 3.75,
};

function perUsd(code: string): number | null {
  return PER_USD[code.toUpperCase()] ?? null;
}

/** Is a default rate available for this currency at all? */
export function hasReference(code: string): boolean {
  return perUsd(code) != null;
}

/** Foreign units per 1 home unit, in MAJOR units — the same convention as
 * deriveRate() and convertToHome()'s `foreignPerHome` (e.g. 438 for PHP→VND, i.e.
 * "1 PHP = 438 VND"). null if either currency is unknown. */
export function referenceForeignPerHome(homeCode: string, foreignCode: string): number | null {
  const h = perUsd(homeCode);
  const f = perUsd(foreignCode);
  if (h == null || f == null || h === 0) return null;
  return f / h;
}

/** Home-MINOR per foreign-MINOR — the same convention as a pool's
 * cost_basis_rate, so it drops straight into getPoolRate()'s callers:
 * `homeMinor = round(foreignMinor * basis)`. null if either currency is unknown. */
export function referenceCostBasis(foreignCode: string, homeCode: string): number | null {
  const h = perUsd(homeCode);
  const f = perUsd(foreignCode);
  if (h == null || f == null || f === 0) return null;
  const homeMajorPerForeignMajor = h / f;
  return (homeMajorPerForeignMajor * 10 ** decimals(homeCode)) / 10 ** decimals(foreignCode);
}
