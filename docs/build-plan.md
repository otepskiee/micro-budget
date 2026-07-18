# Build Plan — Daily Budget + Travel App
**Stack:** Expo (local builds, no EAS) · TypeScript · SQLite local-first · Supabase sync
**Status:** pre-project planning doc, consolidated from design discussion · July 2026

---

## 1. Product thesis

A daily budgeting app with a travel mode, built around one behavioral insight: **people don't fail at budgeting math, they fail at remembering to log.** Every pillar attacks forgetting:

- **Location backtracking** → "you stopped somewhere, did you spend?"
- **Wallet/pool reconciliation** → "your cash count doesn't match, something's unlogged"
- **Receipt scanning** → "photograph it now, sort it later"
- **Nightly review** → one 60-second ritual that closes the day

Travel is the superset; daily is the degenerate case. Build the general machinery once.

### Non-negotiable principles
1. **One ledger.** No `TravelExpense` type, ever. Trips are a view (`trip_id`) over one expense table.
2. **Offline-first.** Everything works with zero signal (Sapa test). Supabase is sync/backup, not the source of truth.
3. **Never store only converted amounts.** Always `amount + currency + source account`. Derived values are recomputable; raw values are sacred.
4. **Never ask the user for an exchange rate.** Derive it from what they can see (gave X, got Y).
5. **Ghost-mode social.** People are local labels. No accounts for companions, no invites, no sync between users in v1.
6. **Location is trip-scoped.** Background tracking only while a trip is active. Daily mode uses cheap geofences at most.
7. **Free features cost ₱0 marginal. Paid features have an API bill behind them.** The freemium line follows the cost line.

---

## 2. Scope

### v1 (ship this)
- Daily expense logging (manual, fast, account optional)
- Monthly budget cycles + categories
- Trips: date range + home currency + members
- Accounts & pools (bank / cash / e-wallet / card / foreign-cash pool with cost basis)
- Transfers (incl. money changer, ATM with fees, card with pending/confirmed)
- Effective-rate costing (weighted average per currency per trip)
- Ghost splitting (people, paid_by vs. splits, settlement summary)
- Receipt capture: photo now, on-device OCR (free tier)
- AI receipt parsing (paid tier, Gemini Flash or Claude Haiku vision)
- Trip-scoped background location → dwell detection → nightly review
- Wallet reconciliation ("count your cash")
- Trip report / export (image or CSV)

### v1.5
- "Your VND by source" rate-comparison view
- Learned card markup (from reconciliation history)
- Daily-mode geofences (office/mall/grocery nudges)
- Recurring expenses, bills

### Explicitly deferred / rejected
- Multiplayer splitting (Splitwise's turf; distributed-systems tax)
- Bank feed integrations (no PH open banking worth building on)
- Real-time spend prompts (obnoxious on holiday; nightly batch only)
- Comments/social anything
- Web app

---

## 3. Architecture

```
┌─────────────────────────────────────────┐
│ Expo app (dev client, built locally)     │
│                                          │
│  UI: Expo Router + NativeWind            │
│  State: Zustand (UI) + TanStack Query    │
│  DB: expo-sqlite (SOURCE OF TRUTH)       │
│  Location: expo-location + expo-task-mgr │
│  OCR: @react-native-ml-kit/text-recog    │
│  Camera: expo-camera / image-picker      │
└──────────────┬──────────────────────────┘
               │ sync when online (queue)
┌──────────────▼──────────────────────────┐
│ Supabase (free tier)                     │
│  Postgres: mirror of local schema + RLS  │
│  Auth: email magic link / Apple / Google │
│  Storage: receipt images (paid tier)     │
│  Edge Functions: AI receipt parse proxy, │
│    FX rate cache, Places proxy           │
└──────────────────────────────────────────┘
External: Gemini Flash (receipts) · Places/Foursquare (POI) ·
          frankfurter.app or similar (FX rates, cached daily)
```

### Why SQLite is the source of truth
- Trips happen offline. A Supabase-first app is dead in Vietnam.
- Single-user + ghost mode means no concurrent writers → sync is simple push/pull, not CRDT hell.
- Supabase's role: backup, device migration, and server-side work (AI calls, rate cache).

### Sync strategy (keep it dumb)
- Every row: `id` (uuidv7, client-generated), `updated_at`, `deleted_at` (soft delete).
- Outbox table: mutations queue locally, flush when online.
- Pull: `where updated_at > last_sync` per table.
- Conflict rule: last-write-wins. Acceptable because one human, ghost companions, no shared data.
- **Do not** adopt PowerSync/WatermelonDB sync/ElectricSQL in v1. Revisit only if multiplayer ever happens.

### Edge Functions (why they exist)
- **AI receipt parse:** keeps the Gemini/Anthropic API key off the device, enforces free/paid gating server-side, returns structured JSON.
- **Places proxy:** same reason (key + quota control) + caching layer keyed by rounded lat/lng so repeat visits are free.
- **FX rates:** one fetch per currency-pair per day, cached in Postgres; app pulls the day's rates at trip start for offline use.

---

## 4. Data model

```sql
-- People (ghost mode: local labels, is_me flags the owner)
people        id, name, avatar_emoji, is_me, created_at

-- Trips
trips         id, name, start_date, end_date, home_currency,
              location_tracking_enabled, status

trip_members  trip_id, person_id

-- Accounts: bank, cash wallet, e-wallet, card, or a foreign-cash POOL
accounts      id, name, currency, type,          -- 'bank'|'cash'|'ewallet'|'card'|'pool'
              cost_basis_rate,                    -- null for home currency
              trip_id,                            -- pools die with their trip
              archived_at

-- Transfers: the ONE entity for moves, exchanges, ATM, card FX
transfers     id, from_account_id, to_account_id,
              from_amount, from_currency,
              to_amount, to_currency,
              timestamp, source,                  -- 'atm'|'changer'|'card'|'internal'
              settlement_status,                  -- 'pending'|'confirmed'
              note

transfer_fees id, transfer_id, label, amount, currency, is_derived

-- Expenses
expenses      id, account_id,                     -- nullable in daily, required in travel
              amount, currency,                   -- INTEGER minor units (ISO 4217)
              category_id, trip_id,               -- both nullable
              paid_by,                            -- person_id, defaults to is_me
              timestamp, note,
              settlement_status,                  -- 'confirmed' unless cross-currency card
              estimated_home_amount, actual_home_amount,
              receipt_id, stay_id                 -- the joins that make this app special

splits        expense_id, person_id, share_amount -- resolved amounts, NEVER percentages
                                                  -- remainder cent assigned deterministically

-- Receipts
receipts      id, image_local_path, image_remote_path,
              ocr_raw_text, parsed_json,          -- merchant, total, currency, date, lines
              parse_method,                       -- 'mlkit'|'ai'|'manual'
              status                              -- 'unprocessed'|'parsed'|'matched'

-- Location (trip-scoped)
location_points id, trip_id, lat, lng, accuracy, timestamp   -- pruned after stay extraction
stays           id, trip_id, lat, lng, arrived_at, departed_at,
                poi_name, poi_category, poi_place_id,
                review_status                     -- 'unreviewed'|'no_spend'|'matched'

-- Budgets (daily mode)
categories    id, name, icon, parent_id
budgets       id, category_id, amount, currency, cycle    -- 'monthly'
```

### Rules encoded in the model
- **Money is integers in minor units.** VND=0 decimals, PHP=2, KWD=3. Look up per ISO 4217. No floats, anywhere, ever.
- **`paid_by` ≠ `splits`.** Who fronted vs. who owes. The entire splitting feature is this distinction.
- **Pool drawdown:** expense in currency X draws from account with currency X; home-value = amount × account's weighted-average cost basis. Weighted average, not FIFO (explainable in one sentence; FIFO isn't).
- **`settlement_status` gating:** if `expense.currency == account.currency` → always `confirmed`, no reconciliation UI. Pending/confirmed machinery only activates across a currency boundary.
- **Stays vs. points:** raw GPS points are working data — cluster into stays nightly, then prune points >7 days old. Keeps DB small and the privacy story clean.

---

## 5. Feature specs

### 5.1 Daily logging (the free core)
- One-thumb entry: amount → category → done. Account optional. Target <5 seconds.
- Monthly cycle view: spent vs. budget per category, safe-to-spend number.
- This must be good enough to compete with Money Manager on its own, because it's the retention layer.

### 5.2 Trips
- Trip = name + dates + home currency + members (multi-select from `people`, frequency-ranked so Yana surfaces first).
- Activating a trip: prompts location permission (if enabled), fetches & caches FX rates for offline, suggests creating pools.
- Expenses timestamped inside the window auto-tag to the trip; overridable.

### 5.3 Money movement
**Money changer:** gave ₱X, got Y VND → pool created/topped-up, basis derived. Simplest flow, build first.
**ATM:** dispensed amount (required) + on-screen fee (optional) + statement charge (optional, addable later). Fill one field → estimated + pending. Fill all → confirmed.
**Card FX:** expense logged at mid-market estimate + learned markup, `pending`. Reconciliation screen when statement arrives — optional, never nagged.
**Fee display setting:** fold into effective rate (default) vs. show as separate fee expenses. Stored itemized regardless; the setting is a lens.

### 5.4 Splitting (ghost)
- Trip members pre-fill every trip expense's split (equal by default).
- Adjust: exclude people, custom amounts, "X paid, split among Y".
- Settlement screen: net balances in home currency at payer's effective rate; export as image for the group chat. Settle on GCash, outside the app.

### 5.5 Receipts
- **Capture:** photo → saved locally → `unprocessed`. Zero-friction, sort later.
- **Free path:** ML Kit on-device OCR → heuristics for total/date (largest currency-formatted number near bottom; PH/VN receipt patterns). Confidence low → hand user a prefilled manual form.
- **Paid path:** image → Edge Function → Gemini Flash → `{merchant, total, currency, date, line_items}` → auto-create expense.
- **Matching:** receipt timestamp + amount vs. existing expenses and stays → auto-link or one-tap confirm.

### 5.6 Location & the nightly review
- **Tracking:** `expo-location` background task, balanced accuracy, distance-filtered. Active trips only. Hard off-switch on the trip screen.
- **Dwell detection:** cluster points within ~50m for >10 min → stay. Tune thresholds against real data (EDSA traffic jam must not become a "stay").
- **POI lookup:** Edge Function → Places/Foursquare nearby search, cached by rounded coordinates. Dense-area fallback: "pick from nearby" list.
- **Nightly review (THE product):** local notification ~8pm. "6 stops today — 3 matched. For the rest: [no spend] [₱ amount] [receipt]." Companion pre-fill makes splits a byproduct. Target: 60 seconds to close the day.
- **Wallet reconciliation:** pool math says you hold X; count your wallet; gap → "you had 3 unlogged stops, was it one of these?" The two amnesia systems cross-reference.

### 5.7 Permissions & onboarding
- Ask for location **only when the user enables tracking on a trip**, with the one-line pitch: *"so you never forget an expense."* Never at app open.
- iOS "Always" location requires escalating from When-In-Use; design the two-step ask.
- Notification permission asked when the first trip starts (it powers the nightly review).

---

## 6. Freemium

| Free forever (₱0 marginal cost) | Paid (real API cost behind it) |
|---|---|
| Manual entry, budgets, categories | AI receipt parsing |
| Trips, multi-currency logging, pools | Location tracking + nightly review |
| Ghost splitting + settlement export | POI resolution for stays |
| On-device OCR | Cloud sync + receipt image backup |
| One active trip history | Unlimited trip history, CSV export |

**Model: per-trip unlock, ₱249–399.** Purchased at peak excitement, no churn shame, revenue correlated with API costs. Optional annual (~₱799) later = "2+ trips prepaid." Lifetime (~₱1,499, capped quantity) for early users.

**Payment reality:** App Store/Play require their IAP for digital goods (15–30% cut, no GCash). Use RevenueCat to abstract IAP across platforms. GCash-direct is only possible for things outside app-store rails — don't design around it for v1.

**v0 is free.** Pricing activates only after the app survives a real trip and ~20 users. Server-side gating lives in the Edge Functions (free tier = no AI parse, no Places), so the split is enforceable without app updates.

---

## 7. Local build workflow (no EAS)

Background location, ML Kit, and background tasks **do not run in Expo Go** — a dev client is mandatory anyway, so local builds are the natural path, not a compromise.

### Setup
```bash
npx create-expo-app@latest --template          # TS template
npx expo prebuild                              # generates android/ + ios/
npx expo run:android                           # local Android build
npx expo run:ios                               # local iOS build (Mac only)
```

- **Android:** Android Studio + SDK + JDK 17. Works on the Windows machine. Physical device over USB for location testing — emulators lie about GPS/battery.
- **iOS:** Xcode, so the Mac. Free Apple ID signs 7-day dev builds; the $99/yr developer account is only needed for TestFlight/App Store. Defer it.
- **Keep prebuild reproducible:** treat `android/`/`ios/` as generated — all native config via `app.json`/config plugins, so `npx expo prebuild --clean` always works. The moment you hand-edit native files, document it or lose it.
- **Config plugins needed:** expo-location (background modes, iOS `UIBackgroundModes: [location]`), expo-task-manager, ML Kit, camera. All standard.
- **Release builds:** `./gradlew assembleRelease` / Xcode Archive. Manual keystore management — back up the Android keystore the day it's created; losing it means losing the Play listing.
- **Updates without stores:** skip expo-updates for v1 (self-hosting it is real work). You're the only user; rebuild is fine.

### Cost of skipping EAS
You give up: cloud builds, easy internal distribution, managed credentials. You keep: ₱0, full control, faster iteration on your own hardware. For a solo dev with a Mac and a Windows box, correct call.

---

## 8. Build phases

**Phase 0 — Skeleton (weekend)**
Expo TS app, dev client building locally on Android. expo-sqlite + migration runner. Schema from §4. Expo Router shell, NativeWind.

**Phase 1 — Ledger (1–2 wks)**
Expenses CRUD, categories, monthly budget view, accounts, integer-money utilities with per-currency decimals. *Usable as a plain daily budgeter here.*

**Phase 2 — Trips + money movement (1–2 wks)**
Trips, pools, transfers (changer first → ATM → card pending/confirmed), weighted-average costing, FX rate caching. *Test: log a fake Vietnam trip end-to-end offline, airplane mode.*

**Phase 3 — Splitting (1 wk)**
People, paid_by/splits, settlement math, export image.

**Phase 4 — Receipts (1–2 wks)**
Camera capture, ML Kit OCR + heuristics, manual-fix form, timestamp/amount matching. AI path stubbed behind a flag.

**Phase 5 — Location (2–3 wks, the hard one)**
Background tracking, dwell clustering, POI lookup via Edge Function, nightly review screen, notification. *Test on your real commute for a week before trusting it on a trip.*

**Phase 6 — Sync + Supabase (1–2 wks)**
Auth, outbox sync, RLS, Edge Functions (AI parse, Places proxy, FX cache). App must remain fully functional signed-out.

**Phase 7 — Field test**
A real trip. The nightly review either feels good or the product thesis is wrong. Instrument: % of stays reviewed, seconds per review, % of expenses auto-matched.

Then: pricing, Play Store, iOS.

**Vibe-coding guardrails:** strict TS from day 0; money utilities and dwell clustering get hand-reviewed unit tests (the two places a model's plausible-looking bug silently corrupts data); tell the model the state stack (Zustand + TanStack Query) or it will scatter useState.

---

## 9. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Source of truth | Local SQLite | Trips are offline; single writer |
| Sync | Outbox + LWW | Ghost mode = no concurrent writers |
| Cost basis | Weighted avg per currency/trip | Explainable; FIFO delta is noise |
| Money type | Integer minor units | Floats corrupt; VND/JPY have no decimals |
| Splits | Stored amounts | Percentages never sum; remainder-cent rule |
| Fees | Itemized always, folded by default | Can't unbake; lens not storage |
| Rates | Derived, never user-entered | Users don't know their real rate |
| Location | Trip-toggled, off by default | Battery + privacy + permission story |
| Prompts | Nightly batch | Real-time is obnoxious |
| Social | Ghost only | Splitwise exists; sync tax not worth it |
| Builds | Local, no EAS | Dev client needed anyway; ₱0 |
| Card recon | Optional, cross-currency only | Most users never reconcile |
| Accounts | Optional daily, required travel | Rigor where it pays, not where it churns |

## 10. Open questions (decide before Phase 2/5)
1. Dwell thresholds — 50m/10min is a starting guess; tune on real commute data.
2. Places vs. Foursquare — compare PH/VN POI coverage and current pricing when building Phase 5.
3. FX rate source — verify current free-tier limits (frankfurter.app, etc.) at Phase 2.
4. Splits × pools × payer: companion pays from their pool → others owe at *payer's* effective rate. Confirm this rule feels fair in practice.
5. Whether you and Yana split at all, or one pot — decides how prominent splitting UI is by default.

## 11. Running cost (you as the only user)
Supabase free tier + local builds + ML Kit + cached FX + trip-only Places calls ≈ **₱0/month**. First real costs appear with other users' AI parses and Places volume — both behind the paywall by design.
