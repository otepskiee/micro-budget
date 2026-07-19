// Heuristic parse of raw OCR text (the FREE tier's brain, once an OCR text source
// is wired). Finds the total, currency, date and a merchant guess. The paid tier
// uses a vision model instead (Edge Function). Pure + tested.
import { decimals } from "../currencies";

export type ParsedReceipt = {
  merchant: string | null;
  totalMinor: number | null;
  currency: string | null;
  date: string | null;
  confidence: number; // 0..1
};

const CURRENCY_HINTS: [RegExp, string][] = [
  [/₱|\bphp\b|\bpeso/i, "PHP"],
  [/₫|\bvnd\b|\bdong/i, "VND"],
  [/\busd\b|\bus\$|\$\s*\d/i, "USD"],
  [/€|\beur\b/i, "EUR"],
  [/¥|\bjpy\b|\byen/i, "JPY"],
];

function detectCurrency(text: string, fallback: string): string {
  for (const [re, code] of CURRENCY_HINTS) if (re.test(text)) return code;
  return fallback;
}

function normalizeNumber(token: string): number | null {
  const hasComma = token.includes(",");
  const hasDot = token.includes(".");
  let t = token;
  if (hasComma && hasDot) {
    // the LAST separator is the decimal point; the other is thousands
    if (token.lastIndexOf(",") > token.lastIndexOf("."))
      t = token.replace(/\./g, "").replace(",", ".");
    else t = token.replace(/,/g, "");
  } else if (hasComma) {
    const after = token.length - token.lastIndexOf(",") - 1;
    const single = token.indexOf(",") === token.lastIndexOf(",");
    // "220,00" is a decimal; "220,000" / "1,234" are thousands
    t =
      after === 2 && single ? token.replace(",", ".") : token.replace(/,/g, "");
  } else if (hasDot) {
    const after = token.length - token.lastIndexOf(".") - 1;
    const single = token.indexOf(".") === token.lastIndexOf(".");
    if (after === 3 && single) t = token.replace(/\./g, ""); // "220.000" thousands
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function numbersIn(s: string): number[] {
  const out: number[] = [];
  const re = /\d[\d.,]*\d|\d/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = normalizeNumber(m[0]);
    if (n != null) out.push(n);
  }
  return out;
}

function largestIn(s: string): number | null {
  const ns = numbersIn(s);
  return ns.length ? Math.max(...ns) : null;
}

function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** decimals(currency));
}

const DATE_RES: RegExp[] = [
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, // yyyy-mm-dd
  /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/, // dd-mm-yyyy
];

function detectDate(text: string): string | null {
  for (const re of DATE_RES) {
    const m = text.match(re);
    if (!m) continue;
    let y: number, mo: number, d: number;
    if (m[1].length === 4) {
      y = +m[1];
      mo = +m[2];
      d = +m[3];
    } else {
      d = +m[1];
      mo = +m[2];
      y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    }
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

export function parseReceiptText(
  raw: string,
  homeCurrency = "PHP",
): ParsedReceipt {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const text = lines.join("\n");
  const currency = detectCurrency(text, homeCurrency);

  // total: prefer a line mentioning total/amount due/balance; else the largest number
  const totalLine = lines.find((l) =>
    /\b(grand\s*)?total\b|amount\s*due|balance\s*due/i.test(l),
  );
  let totalMajor: number | null = totalLine ? largestIn(totalLine) : null;
  const usedKeyword = totalMajor != null;
  if (totalMajor == null) {
    const nums = lines.map(largestIn).filter((n): n is number => n != null);
    totalMajor = nums.length ? Math.max(...nums) : null;
  }

  const merchant =
    lines.find(
      (l) => /[A-Za-z]/.test(l) && !/receipt|invoice|total|date|time/i.test(l),
    ) ?? null;
  const date = detectDate(text);

  let confidence = 0;
  if (totalMajor != null) confidence += usedKeyword ? 0.6 : 0.35;
  if (date) confidence += 0.2;
  if (merchant) confidence += 0.15;
  if (currency !== homeCurrency) confidence += 0.05;

  return {
    merchant,
    totalMinor: totalMajor != null ? toMinor(totalMajor, currency) : null,
    currency,
    date,
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
  };
}
