// Verifies the pure logic cores against known cases. Run: npx tsx scripts/verify-logic.ts
import { clusterStays, type Point } from "../src/lib/geo/cluster";
import { computeBalances, simplifyDebts, type SettleExpense } from "../src/lib/split/settle";
import { poolEffectiveRate, poolDrawHome } from "../src/lib/pool";
import { parseReceiptText } from "../src/lib/receipt/parse";
import { splitEvenly, convertToHome } from "../src/lib/money";
import {
  referenceForeignPerHome,
  referenceCostBasis,
  hasReference,
} from "../src/lib/fx/reference";

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean, got?: unknown) {
  if (cond) {
    pass++;
    console.log("ok   " + label);
  } else {
    fail++;
    console.log("FAIL " + label + (got !== undefined ? "  got: " + JSON.stringify(got) : ""));
  }
}

// ---- dwell clustering ----
const t = (h: number, m: number) => `2026-07-09T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
const points: Point[] = [
  { lat: 14.5995, lng: 120.9842, timestamp: t(9, 0) },
  { lat: 14.5995, lng: 120.9842, timestamp: t(9, 5) },
  { lat: 14.5995, lng: 120.9842, timestamp: t(9, 10) },
  { lat: 14.5995, lng: 120.9842, timestamp: t(9, 15) }, // 15-min dwell -> stay
  { lat: 14.605, lng: 120.9842, timestamp: t(9, 20) }, // transit, single point
  { lat: 14.61, lng: 120.9842, timestamp: t(9, 40) },
  { lat: 14.61, lng: 120.9842, timestamp: t(9, 51) },
  { lat: 14.61, lng: 120.9842, timestamp: t(10, 2) }, // 22-min dwell -> stay
];
const stays = clusterStays(points);
ok("clustering finds 2 stays", stays.length === 2, stays.length);
ok("first stay dwell >= 10min", new Date(stays[0].departedAt).getTime() - new Date(stays[0].arrivedAt).getTime() >= 6e5);

// ---- settlement (matches the design: Yana owes You) ----
const me = "me";
const yana = "yana";
const eq = (id: string, payer: string, homeMinor: number): SettleExpense => {
  const [a, b] = splitEvenly(homeMinor, 2);
  return { id, paidBy: payer, homeMinor, splits: [{ personId: me, shareMinor: a }, { personId: yana, shareMinor: b }] };
};
const expenses = [
  eq("plane", me, 420000), // PHP 4,200
  eq("coffee", me, 20000), // PHP 200
  eq("lunch", me, 48900), // PHP 489
  eq("bus", yana, 40000), // PHP 400
];
const net = computeBalances(expenses);
ok("net(me) = +224450", net.get(me) === 224450, net.get(me));
ok("net(yana) = -224450", net.get(yana) === -224450, net.get(yana));
ok("balances sum to zero", (net.get(me) ?? 0) + (net.get(yana) ?? 0) === 0);
const transfers = simplifyDebts(net);
ok("one transfer yana->me 224450", transfers.length === 1 && transfers[0].from === yana && transfers[0].to === me && transfers[0].amount === 224450, transfers);

// ---- pool cost basis ----
const rate = poolEffectiveRate([{ foreignMinor: 900000, homeMinor: 200000 }]); // VND 900k cost PHP 2,000
ok("pool rate ~ 0.2222", Math.abs(rate - 200000 / 900000) < 1e-9, rate);
ok("draw VND 90,000 -> PHP 200 (20000 minor)", poolDrawHome(90000, rate) === 20000, poolDrawHome(90000, rate));

// ---- OCR heuristic parse ----
const vnd = parseReceiptText(
  ["Bún Chả Hương Liên", "123 Le Van Huu, Hanoi", "2026-07-09", "Pho x2   180,000", "Total   220,000 VND"].join("\n"),
);
ok("VND receipt currency", vnd.currency === "VND", vnd.currency);
ok("VND receipt total 220,000", vnd.totalMinor === 220000, vnd.totalMinor);
ok("VND receipt date", vnd.date === "2026-07-09", vnd.date);
ok("VND receipt merchant", (vnd.merchant ?? "").startsWith("Bún"), vnd.merchant);

const php = parseReceiptText(["Jollibee", "GRAND TOTAL   185.00"].join("\n"));
ok("PHP receipt total 185.00 (18500 minor)", php.totalMinor === 18500, php.totalMinor);
ok("PHP fallback currency", php.currency === "PHP", php.currency);

// ---- reference (default) FX ----
const vndPerPhp = referenceForeignPerHome("PHP", "VND");
ok("reference PHP->VND in sane range (300..600)", vndPerPhp != null && vndPerPhp > 300 && vndPerPhp < 600, vndPerPhp);
const phpPerVnd = referenceForeignPerHome("VND", "PHP");
ok(
  "reference cross-rate is reciprocal (~1)",
  vndPerPhp != null && phpPerVnd != null && Math.abs(vndPerPhp * phpPerVnd - 1) < 1e-9,
  vndPerPhp != null && phpPerVnd != null ? vndPerPhp * phpPerVnd : null,
);
// cost-basis (home-minor/foreign-minor) must agree with convertToHome via foreignPerHome
const refBasis = referenceCostBasis("VND", "PHP")!;
ok(
  "reference VND->PHP cost basis matches convertToHome",
  Math.round(90000 * refBasis) === convertToHome(90000, "VND", "PHP", vndPerPhp!),
  { viaBasis: Math.round(90000 * refBasis), viaConvert: convertToHome(90000, "VND", "PHP", vndPerPhp!) },
);
ok("reference VND 90,000 lands near PHP 200 (150..260)", (() => {
  const php = Math.round(90000 * refBasis) / 100;
  return php > 150 && php < 260;
})(), Math.round(90000 * refBasis) / 100);
ok("unknown currency has no reference", !hasReference("ZZZ") && referenceCostBasis("ZZZ", "PHP") === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
