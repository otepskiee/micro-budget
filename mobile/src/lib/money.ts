// Integer money in ISO-4217 minor units. Never store a float or a converted-only
// amount — always keep amount + currency; derived home values are recomputable.
import { decimals } from "./currencies";

export type Minor = number; // integer minor units (safe for money magnitudes)

export function toMinor(major: number, code: string): Minor {
  return Math.round(major * 10 ** decimals(code));
}

export function toMajor(minor: Minor, code: string): number {
  return minor / 10 ** decimals(code);
}

function group(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "VND 90,000" / "PHP 200" / "PHP 200.50". Money is written with the ISO code,
 * not a symbol (truer across currencies, and the embedded fonts lack ₱/₫). */
export function format(
  minor: Minor,
  code: string,
  opts: { code?: boolean; trim?: boolean } = {},
): string {
  const withCode = opts.code ?? true;
  const trim = opts.trim ?? true;
  const dec = decimals(code);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const scale = 10 ** dec;
  const int = Math.floor(abs / scale);
  const frac = abs % scale;
  let out = group(String(int));
  if (dec > 0 && !(trim && frac === 0)) out += "." + String(frac).padStart(dec, "0");
  return (withCode ? code.toUpperCase() + " " : "") + (neg ? "-" : "") + out;
}

export function parseAmount(input: string, code: string): Minor {
  const clean = input.replace(/[^0-9.]/g, "");
  const major = parseFloat(clean || "0");
  return toMinor(Number.isNaN(major) ? 0 : major, code);
}

/** Split a total into n shares that ALWAYS sum back to the total. The remainder
 * unit is assigned deterministically to the first `rem` shares. Amounts, never
 * percentages — this is the whole splitting feature's correctness guarantee. */
export function splitEvenly(total: Minor, n: number): Minor[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const rem = total - base * n; // 0..n-1 for a positive total
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** Derive the effective rate from what the user can see: gave X of A, got Y of B.
 * Returns units of B per 1 unit of A (e.g. gave PHP 2,000, got VND 900,000 -> 450). */
export function deriveRate(
  gaveMinor: Minor,
  gaveCode: string,
  gotMinor: Minor,
  gotCode: string,
): number {
  const gave = toMajor(gaveMinor, gaveCode);
  const got = toMajor(gotMinor, gotCode);
  return gave === 0 ? 0 : got / gave;
}

/** Convert a foreign amount to home minor units. `foreignPerHome` is the rate in
 * foreign units per 1 home unit (e.g. 450 VND per PHP). */
export function convertToHome(
  foreignMinor: Minor,
  foreignCode: string,
  homeCode: string,
  foreignPerHome: number,
): Minor {
  if (foreignPerHome === 0) return 0;
  const homeMajor = toMajor(foreignMinor, foreignCode) / foreignPerHome;
  return Math.round(homeMajor * 10 ** decimals(homeCode));
}
