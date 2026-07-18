// Standalone verification of the money algorithm (mirrors src/lib/money.ts).
// Run: node scripts/verify-money.mjs   — proves the tricky bits before shipping.
const DEC = { VND: 0, JPY: 0, KRW: 0, KWD: 3, BHD: 3 };
const decimals = (c) => (c in DEC ? DEC[c] : 2);
const toMinor = (maj, c) => Math.round(maj * 10 ** decimals(c));
const toMajor = (m, c) => m / 10 ** decimals(c);
const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
function format(m, c, { code = true, trim = true } = {}) {
  const dec = decimals(c), abs = Math.abs(m), scale = 10 ** dec;
  const int = Math.floor(abs / scale), frac = abs % scale;
  let out = group(String(int));
  if (dec > 0 && !(trim && frac === 0)) out += "." + String(frac).padStart(dec, "0");
  return (code ? c + " " : "") + (m < 0 ? "-" : "") + out;
}
function splitEvenly(total, n) {
  const base = Math.floor(total / n), rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
const deriveRate = (gm, gc, tm, tc) => (toMajor(gm, gc) === 0 ? 0 : toMajor(tm, tc) / toMajor(gm, gc));
function convertToHome(fm, fc, hc, fph) {
  return fph === 0 ? 0 : Math.round((toMajor(fm, fc) / fph) * 10 ** decimals(hc));
}

let pass = 0, fail = 0;
const nb = (s) => s.replace(/ /g, " ");
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok  " : "FAIL"} ${label} => ${JSON.stringify(nb(String(got)))}`);
  ok ? pass++ : (fail++, console.log(`      expected ${JSON.stringify(want)}`));
}

// formatting
eq("format VND 90,000", nb(format(90000, "VND")), "VND 90,000");
eq("format PHP 200 (trim)", nb(format(20000, "PHP")), "PHP 200");
eq("format PHP 200.50", nb(format(20050, "PHP")), "PHP 200.50");
eq("format PHP 488.89", nb(format(48889, "PHP")), "PHP 488.89");
eq("format no-code", nb(format(378000, "VND", { code: false })), "378,000");

// derived rate + conversion (the "it already knows your rate" feature)
eq("deriveRate gave PHP2000 got VND900000", deriveRate(200000, "PHP", 900000, "VND"), 450);
eq("VND 90,000 -> PHP", format(convertToHome(90000, "VND", "PHP", 450), "PHP"), "PHP 200");
eq("VND 220,000 -> PHP", format(convertToHome(220000, "VND", "PHP", 450), "PHP"), "PHP 488.89");
eq("VND 300,000 -> PHP", nb(format(convertToHome(300000, "VND", "PHP", 450), "PHP")), "PHP 666.67");

// splits ALWAYS sum back to the whole
for (const [total, n] of [[48889, 2], [100000, 3], [7, 3], [489, 2], [1, 4]]) {
  const parts = splitEvenly(total, n);
  eq(`split ${total}/${n} sums`, parts.reduce((a, b) => a + b, 0), total);
}
eq("split 100000/3 shape", splitEvenly(100000, 3), [33334, 33333, 33333]);
eq("split 7/3 shape", splitEvenly(7, 3), [3, 2, 2]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
