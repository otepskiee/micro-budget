// ISO-4217 minor-unit exponents. Money is stored as integers of these units;
// floats never touch money. Default is 2 decimals; these are the exceptions.
export const CURRENCY_DECIMALS: Record<string, number> = {
  // zero-decimal
  VND: 0, JPY: 0, KRW: 0, ISK: 0, CLP: 0, PYG: 0, UGX: 0, RWF: 0, VUV: 0,
  XOF: 0, XAF: 0, XPF: 0, KMF: 0, DJF: 0, GNF: 0, BIF: 0,
  // three-decimal
  KWD: 3, BHD: 3, OMR: 3, TND: 3, IQD: 3, JOD: 3, LYD: 3,
};

export function decimals(code: string): number {
  return CURRENCY_DECIMALS[code.toUpperCase()] ?? 2;
}
