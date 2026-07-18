# Micro Budget

> **You don’t fail at the math. You forget to log.**

Micro Budget is a daily budgeting app with a travel mode, built on one behavioral
insight: people don’t fail at budgeting *arithmetic* — they fail at *remembering to
log*. Every feature attacks forgetting.

This repository currently holds the **visual concept design** — the identity and the
key screens — that comes *before* the Expo / React Native build described in
[`docs/build-plan.md`](docs/build-plan.md).

---

## View it

Open **[`index.html`](index.html)** in any browser. It is a single, self-contained
file — every font is embedded, and it makes **zero network requests**.

The page presents the design as one continuous receipt-tape, with the app’s four key
screens rendered in device frames:

| Screen | What it shows |
| --- | --- |
| **Nightly Review** (signature) | The day retraced as a receipt; forgotten geo-stops appear as amber *gaps* to recover. Tap a gap to seal it. |
| **Today** | Fast daily logging, “safe to spend” as a printed budget line, category warnings, pre-tagged future spend. |
| **New Expense** | Multi-currency accuracy (rate derived from *gave-X-got-Y*), receipt OCR (free) and AI Parse (paid). |
| **Settle Up** | Ghost split — who *fronted* vs who *owes*, netted at the real rate, exported for the group chat. |

## The design — “The Ledger-Tape”

The whole app is one **thermal receipt-tape** on a cool green-grey ground. Time and
place run down the left rail; multi-currency money runs down the right, joined by a
dotted leader. **Continuity *is* the accounting** — unbroken tape is time you’ve
accounted for; a break in the tape is money you forgot. A two-temperature system
carries state everywhere:

- **Teal** — confirmed / settled / certain
- **Amber** — recall / a gap / pending
- **Red** — over budget / owed

It is deliberately **flat and printed**: perforations, dotted leaders, tabular rules,
one stamp. No shadows, no glow, no gradients, no faux paper texture.

**Type** — Bricolage Grotesque (ritual headers only) · Hanken Grotesk (all UI) ·
Fragment Mono (every figure, tabular). Money is written as **ISO codes** (`PHP`,
`VND`) rather than symbols — truer across currencies, and it aligns to the digit.

## Rebuild

The committed `index.html` is generated. To regenerate it after editing the source:

```bash
python build.py
```

This injects the inlined `@font-face` data-URIs (`src/fonts.css`) into the body-only
template (`src/index.template.html`) and emits:

- `index.html` — the standalone document above
- `build/artifact_body.html` — a body-only variant for embedding

```
src/
  index.template.html   # the design: CSS + markup + JS (fonts marker)
  fonts.css             # inlined @font-face data-URIs (generated)
  fonts/NOTICE.md       # font licenses
build.py                # font-injection build
index.html              # generated, self-contained — open this
docs/
  build-plan.md         # the full engineering plan (stack, schema, phases)
  content-spec.md       # the real numbers/copy the screens are grounded in
```

## Roadmap

Per [`docs/build-plan.md`](docs/build-plan.md): **Expo (local builds) · TypeScript ·
expo-sqlite (offline-first source of truth) · Supabase sync + Edge Functions ·
Expo Router + NativeWind · Zustand + TanStack Query.** The CSS here maps cleanly to
NativeWind (Tailwind), so this design is the direct input to Phase 1.

## Fonts

Bricolage Grotesque, Hanken Grotesk and Fragment Mono are all licensed under the
**SIL Open Font License 1.1**. See [`src/fonts/NOTICE.md`](src/fonts/NOTICE.md).
