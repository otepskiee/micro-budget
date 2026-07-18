# Micro Budget — Content Spec (real numbers, no lorem)

Persona: **Jo** (owner, is_me), home currency **PHP**. Companion: **Yana** (ghost label, no app).
Trip: **Hanoi, Vietnam** (Jul 7–13), currently **Day 3, ~8:14 PM** (nightly review time).
Home mode context: **Manila**, July budget cycle.

## Derived FX (never asked, derived from "gave X, got Y")
- Money changer: gave **PHP 2,000** → got **VND 900,000**  ⇒ effective rate **450 ₫ per ₱1** (1 VND ≈ 0.00222 PHP).
- All VND→PHP below use 450.

| VND | PHP |
|---|---|
| 90,000 | 200 |
| 220,000 | 489 |
| 68,000 | 151 |
| 300,000 | 667 |
| 378,000 (day total) | 840 |

## SCREEN A — Nightly Review / The Trail (SIGNATURE)  — Hanoi, Day 3, 8:14 PM
Header: "Hanoi · Day 3" · today VND 378,000 ≈ PHP 840 · "6 stops · 4 matched · 2 to review"
Trail nodes (chronological, from geo dwell detection):
1. 08:32  The Chi Boutique (hotel)        — no spend (breakfast incl.)      state: reviewed
2. 09:24  Cộng Càphê (café) · 32 min       — Egg coffee ×2  VND 90,000 (PHP 200)  matched · split w/ Yana
3. 10:41  Hoàn Kiếm Lake · 41 min          — **GAP: spend anything?**  ← ember, primary
              actions: [No spend]  [Add expense]  [Attach receipt]
4. 12:15  Bún Chả Hương Liên (lunch)       — VND 220,000 (PHP 489)  matched (receipt) · split w/ Yana
5. 14:05  Đồng Xuân Market · 28 min        — **GAP** ← ember, secondary/softer
6. 16:20  Grab ride                        — VND 68,000 (PHP 151)  auto-matched
7. 19:30  The Chi Boutique (hotel)         — now
Footer CTA: "Close the day" (60-second ritual). Micro-copy near gap: "You stopped here 41 min. GPS trail only — nothing sent anywhere."

## SCREEN B — Today / Home (daily mode, Manila, free core)
Month **July** · Budget **PHP 24,000** · Spent **PHP 16,320 (68%)** · **Safe to spend today: PHP 410**
Slim "month road" progress: day 19 of 31, spend pace slightly ahead.
Categories (spent / limit): Food 6,840/8,000 · Transport 3,120/3,500 · Home 4,200/4,500 · Fun 2,160/8,000
Today (Manila):
- 08:10  Kape (café)             PHP 145   Food
- 08:40  Grab to office         PHP 220   Transport
- 12:30  Lunch · Jollibee       PHP 185   Food
Quick-add FAB (amount → category → done, <5s). Optional account.
Ambient banner: "Sapa trip in 12 days · 1 expense pre-tagged (plane ticket)."

## SCREEN C — Add expense + multi-currency + receipt (freemium OCR)
Editing the Bún Chả lunch:
- Amount: **VND 220,000**  →  live: "= **PHP 489** at your Hanoi rate (450 ₫/₱)"
- Account: **VND cash pool** (weighted-avg basis) · Category: **Food** · Trip: **Hanoi**
- Split: with **Yana**, equal → **PHP 244 each**
- Receipt: scanned thumb. On-device OCR (FREE) read: merchant "Bún Chả Hương Liên" · total 220,000 · date · **confidence 84%**.
- Upsell row: "**AI Parse** — itemize every line, auto-categorize" (paid tier). Free stays free.

## SCREEN D — Split / Settlement (ghost, Yana)  — export for the chat
Trip **Hanoi (Jul 7–13)** · Members **Jo, Yana**
Shared so far: you fronted **VND 610,000**, Yana fronted **VND 180,000**.
Net: **"Yana owes you PHP 478"** (settled at your effective rate; pay outside on GCash).
Shared items:
- ✈ Manila→Hanoi (pre-bought Jun 24)   PHP 4,200   split → your share PHP 2,100  [travel-tagged, pre-trip]
- Egg coffee ×2                         VND 90,000  you paid
- Bún Chả lunch                         VND 220,000 you paid
- Sapa bus (Yana paid)                  VND 180,000 Yana paid
Actions: [Remind Yana]  ·  [Export summary image]  ·  [Mark settled]
Ghost note: "Yana doesn't need the app — send them the summary."

## Motion moment (one, reduced-motion safe)
The trail line strokes itself in on load (retracing the day), top→now; ember gaps fade/breathe in last. Prefers-reduced-motion: no draw, gaps simply present.

## Notation rules
- Money = ISO code + amount in mono/data face (PHP 840, VND 378,000). No ₱/₫ glyphs (font gap).
- All icons = inline SVG (route pins, gap ring, check, arrow, camera, receipt).
- Sequence markers = real timestamps (order carries meaning), never 01/02/03.
