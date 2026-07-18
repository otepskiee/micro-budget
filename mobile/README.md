# Micro Budget — mobile app

Expo (SDK 57) · TypeScript · Expo Router · NativeWind · **local-first SQLite** ·
Supabase (auth + sync) · PostHog · local notifications.

This is the real app (Phase 0–1 of [`../docs/build-plan.md`](../docs/build-plan.md)).
The design it implements lives at the repo root (`../index.html`).

## Principles wired in

- **Local-first, no account required.** Everything is written to on-device SQLite
  (the source of truth). The app is fully usable signed-out. Signing in is optional
  and only turns on cloud backup: every change is captured in an `outbox` and
  flushed to Supabase on sign-in (`src/lib/sync.ts`).
- **Daily first, travel as a superset.** The **Today** tab is a plain daily
  budgeter (categories, monthly budgets, warnings) with no trip and no account.
  Travel mode is the same ledger with a `trip_id` and multi-currency.
- **Money is integers.** ISO-4217 minor units, never floats; splits always sum
  back to the whole (`src/lib/money.ts`, verified by `scripts/verify-money.mjs`).
- **Two-temperature theme, light + dark.** Receipt palette as CSS-variable tokens
  in `src/global.css`, flipping with the system scheme (toggle in Account).
- **Nightly review notification** at 8pm (`src/lib/notifications.ts`).

## Run it

Native modules (SQLite, location, camera, notifications) need a **dev client** —
Expo Go won't work. Local builds, no EAS (per the plan):

```bash
cp .env.example .env        # fill in keys (already present locally)
npx expo run:android        # or: npx expo run:ios   (macOS)
```

Requires Android Studio + JDK 17 (Android) or Xcode (iOS). Test location/battery on
a **physical device** — emulators lie about GPS.

Checks that pass today:

```bash
node scripts/verify-money.mjs   # money/split correctness (16 assertions)
npx tsc --noEmit                # types
npx expo-doctor                 # project health (20/20)
```

## Env

`.env` (gitignored) — all client-safe public keys:

```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_POSTHOG_KEY=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

The Supabase **DB password** is not here and never should be — it's admin-only.
Apply the schema from [`../supabase/migrations`](../supabase/migrations) (see
[`../docs/supabase-setup.md`](../docs/supabase-setup.md)).

## Layout

```
src/
  app/                 # Expo Router
    _layout.tsx        # providers: PostHog, SafeArea, DB init + seed, nightly notif
    (tabs)/
      index.tsx        # Today — daily budgeter, wired to SQLite
      trips.tsx        # Trips — travel mode (multi-currency)
      account.tsx      # optional sign-in, sync, theme + reminder prefs
    expense/new.tsx    # log an expense (daily by default)
  components/mb.tsx    # receipt-tape UI primitives (NativeWind)
  lib/
    money.ts           # integer money + deterministic splits (tested)
    db/                # SQLite: schema, migrations, mutations (+outbox), queries, seed
    supabase.ts        # client (publishable key + session storage)
    auth.ts            # optional session; flushes outbox on sign-in
    sync.ts            # outbox push to Supabase
    analytics.ts       # PostHog (EU)
    notifications.ts   # 8pm nightly-review local notification
    theme.ts           # palette + color-scheme hook
```

## Not yet (next)

- The signature **Nightly Review** screen (geo-trail + amber gap recovery) under a
  trip; background location + dwell clustering.
- Receipt capture + OCR (free) / AI Parse (paid), via a Supabase Edge Function.
- Sync **pull** (server → local, last-write-wins) and composite-key table sync.
- Real display faces (Bricolage / Hanken / Fragment Mono) via `expo-font` (.ttf).
