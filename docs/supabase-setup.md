# Supabase setup

Micro Budget uses Supabase as **auth + sync/backup + Edge Functions**, with the
device's local **SQLite as the source of truth** (offline-first — see
[`build-plan.md`](build-plan.md) §3). Supabase is not the primary data store.

Project ref: `qpzrzjwdgeomiedtaisf` · URL: `https://qpzrzjwdgeomiedtaisf.supabase.co`

## 🔐 Secrets

| Value | Sensitivity | Where it lives |
| --- | --- | --- |
| `SUPABASE_URL` | public | client + `.env.local` |
| `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) | **public by design** — client key, guarded by RLS | client + `.env.local` |
| DB password / `postgres://…` connection string | **secret — admin access** | never in the repo; `supabase link` prompts for it |

`.env.local` is gitignored; `.env.example` is the committed template. **Rotate the
DB password** (Dashboard → Settings → Database → Reset password) — it was shared in
chat, so treat it as compromised.

## 1. MCP server (already configured)

[`.mcp.json`](../.mcp.json) registers the Supabase MCP server (project-scoped, no
secrets). To connect, in a **real terminal** (not the IDE extension):

```bash
claude /mcp        # select "supabase" → Authenticate (OAuth)
```

Then **restart Claude Code** so the Supabase tools load into the session.

## 2. Apply the schema

The initial schema is [`supabase/migrations/20260719000001_init.sql`](../supabase/migrations/20260719000001_init.sql)
(full data model from the build plan, with RLS so each user sees only their rows).
Apply it any one of these ways:

- **MCP** (after step 1 + restart): ask Claude to apply the migration.
- **Supabase CLI:**
  ```bash
  supabase link --project-ref qpzrzjwdgeomiedtaisf   # prompts for DB password
  supabase db push
  ```
- **Dashboard:** paste the migration into SQL Editor and run.

## 3. Auth

Enable the providers you want in Dashboard → Authentication (email magic link is the
plan's default; Apple / Google optional). RLS policies already assume `auth.uid()`
ownership, so no data is readable until a user signs in.

## Next (per build plan)

- Edge Functions: AI receipt parse (keeps the model API key server-side), Places
  proxy (cached by rounded lat/lng), FX-rate cache.
- Storage bucket for receipt images (paid tier).
- Outbox-based sync from the local SQLite ledger (last-write-wins).
