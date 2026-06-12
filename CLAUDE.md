# CLAUDE.md — Project Context Briefing

This file gives an AI assistant everything it needs to work in this repo without re-deriving it.
Read this first. For deploy/ops instructions written for humans, see `README.md` and `OAUTH_SETUP.md`.

---

## 1. What this is

**KM Socials Command Center** — a private, multi-tenant social + podcast analytics platform built for
**Kyle Matthews (KM)** and **The Matthews Mentality Podcast (TMMP)**.

It pulls live stats from **7 platforms** (Spotify, Captivate, YouTube, Instagram, TikTok, LinkedIn, X),
stores immutable time-series **snapshots**, charts growth over time, auto-writes strategic **AI insights**
via Claude, and produces **branded PDF recaps** (a Canva replacement for the social-media meeting).

Think: a focused, self-hosted Buffer/Hootsuite + an AI analyst, for one brand's two accounts.

- **Tenant model:** one `org` (KM) → two `accounts` (KM personal, TMMP show) → 7 `platform_connections` each.
- **Audience:** internal team, signed in via Supabase Auth, gated by org membership (RLS).

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js **14.2.31**, App Router, React Server Components |
| Language | TypeScript 5.6, path alias `@/*` → repo root |
| UI | React 18.3, Tailwind 3.4 (dark "glass" theme), Recharts 2.13 |
| Backend / DB | Supabase (Postgres + Auth + RLS + Realtime) via `@supabase/ssr` + `@supabase/supabase-js` |
| AI | Anthropic Claude via `@anthropic-ai/sdk` (Opus / Sonnet / Haiku tiers) |
| PDF | `@react-pdf/renderer` v4 |
| File storage | Vercel Blob (`@vercel/blob`) for post screenshots |
| Validation | Zod 3 |
| Hosting | Vercel (cron jobs + Blob), Supabase, Anthropic |

Node `>=18.17`. **npm** is the documented package manager (a `pnpm-lock.yaml` also exists — prefer npm).

---

## 3. Commands

```bash
npm run dev         # next dev on PORT 3001  (note: OAuth docs reference 3000 — see Gotchas)
npm run build       # next build
npm run start       # next start
npm run lint        # next lint
npm run typecheck   # tsc --noEmit   <-- run this after edits; there is NO unit test suite
npm run db:reset    # supabase db reset
npm run db:push     # supabase db push (applies migrations)
npm run db:migration# supabase migration new
```

There is **no Jest/Vitest/Playwright**. "Tests" are ad-hoc operational scripts in `scripts/*.mjs`
(e.g. `db-check.mjs`, `dev-signin.mjs`, `test-captivate.mjs`, `test-ig-pull.mjs`, `probe-*.mjs`,
`grant-org-membership.mjs`) run directly with `node`. **Verify changes with `npm run typecheck`.**

---

## 4. Directory map

```
app/
  api/
    auth/                         # callback (code exchange), signout
    cron/                         # daily-light, token-health, weekly-snapshot  (Bearer CRON_SECRET)
    insights/                     # AI insight generation
    platforms/[platform]/         # connect (PKCE) + callback (OAuth); + captivate/manual, spotify/set-show
    posts/upload/                 # Vercel Blob image upload
    recap/                        # generate; [id]/pdf (React-PDF render)
    snapshots/                    # read; manual (Zod-validated manual entry)
    team/                         # invite, revoke, role
  dashboard/                      # protected UI: overview, insights, recap, platform/[...], settings, snapshots/new
  login/  layout.tsx  page.tsx  globals.css
components/  charts/ dashboard/ layout/ recap/ ui/
lib/
  ai/           claude.ts (client + model tiers), insights.ts (prompts)
  platforms/    types.ts (PlatformAdapter interface), index.ts (registry), + 7 adapters
  supabase/     client.ts (browser), server.ts (server + admin), types.ts (hand-written Database type)
  token-manager.ts   crypto.ts   alerts.ts   snapshot-engine.ts   dashboard-data.ts   recap-pdf.tsx   utils.ts
supabase/migrations/  0001..0006 + combined file
scripts/        *.mjs dev/ops scripts
middleware.ts   # auth gating
vercel.json     # cron schedules + function maxDuration limits
```

---

## 5. Core architecture & patterns

### Adapter pattern (the spine)
Every platform implements the **`PlatformAdapter`** interface in `lib/platforms/types.ts`:
`authorizeUrl`, `exchangeCode`, optional `refresh`, `pullSnapshot`. Each returns a **normalized**
`NormalizedSnapshot` / `NormalizedPost`. The snapshot engine, dashboard, and recap builder are all
**platform-agnostic** because of this. Adding a platform = write an adapter + register it in
`lib/platforms/index.ts` (`getPlatform(kind)`).

### Normalization + raw preservation
All platforms map into one universal metric shape (~20 columns), AND the full provider payload is
stored verbatim in `snapshots.raw jsonb`. **Never lossy** — if a metric isn't surfaced yet, it's still in `raw`.

### Append-only time series
`snapshots` rows are **never overwritten**. Follower `growth` is computed as a delta vs. the latest prior
snapshot. History is the product.

### Two Supabase clients (critical distinction)
- `supabaseServer()` — RLS-scoped to the signed-in user. Use for **user-facing** routes/pages.
- `supabaseAdmin()` — **service role, bypasses RLS**. Use ONLY in cron jobs, the snapshot engine, and the
  token manager. Never expose admin-client data to a user without an org-membership check.

### Self-healing crons
Token-health and pull jobs deliberately **re-include `expired`/`error` connections** so transient failures
recover automatically. Only states that genuinely require a human (e.g. `manual_only`) are skipped.

### Validation & AI JSON
Zod validates POST bodies. AI responses are parsed by extracting the first `{...}` block with a `{}` fallback.

---

## 6. Token management (`lib/token-manager.ts`) — the trickiest module

`getValidAccessToken(connectionId)` is the **single chokepoint** for obtaining a usable access token. Flow:

1. Read the connection. If no `access_token_enc` → throw `TokenRefreshError('...', 'manual_only')`.
2. If token isn't within its per-platform refresh lead window → decrypt and return it.
3. If the adapter has **no `refresh()`** (LinkedIn personal, Captivate API key) → return current token as-is;
   a dead token will 401 on pull and the engine parks the connection.
4. Otherwise acquire a **row-level lease lock** via the `try_lock_connection_refresh(conn, lease_seconds)` RPC,
   re-read (double-check), call `adapter.refresh()`, then **persist the rotated refresh token FIRST**.
5. On `invalid_grant`/`40[013]`/`invalid_token` → status `expired` (fatal, needs re-auth). Otherwise `error`
   (transient, cron retries). Both fire `notifyConnectionFlip()` → `ALERT_WEBHOOK_URL` on a status change.

**Refresh lead windows** (`REFRESH_LEAD_MS`): Spotify/YouTube/X = 5 min, TikTok = 10 min, Instagram = 14 days,
LinkedIn = 0, Captivate = 0.

**Why a lease lock and not `pg_*_advisory_lock`:** Supabase pools Postgres through **pgbouncer**, so session
advisory locks leak across requests and txn advisory locks release the instant the RPC returns — neither
serializes the external HTTP refresh. A short row-level lease (30 s, 250 ms poll, ~7.5 s max wait) is the
correct primitive here. Migration `0006` defines `try_lock_connection_refresh` (granted to `service_role` only).

**Rotation safety:** X and TikTok invalidate the OLD refresh token the instant the refresh response is
generated, so persisting the NEW refresh token before anything else is non-negotiable.

If the RPC doesn't exist yet (migration not applied) the lock **degrades to no-lock** so dev isn't blocked.

---

## 7. Crypto (`lib/crypto.ts`)

- **AES-256-GCM** token encryption, stored as `base64(iv | tag | ciphertext)`, keyed by `TOKEN_ENCRYPTION_KEY`
  (must base64-decode to exactly **32 bytes**).
- `pkcePair()` for OAuth PKCE; HMAC `signState()` / `verifyState()` (timing-safe) for the OAuth `state` cookie.
- ⚠️ **`TOKEN_ENCRYPTION_KEY` is immutable in production.** Rotating it bricks every stored token and forces a
  full re-auth of all platforms. Treat it as write-once.

---

## 8. Database (`supabase/migrations/`, 0001→0006)

Postgres with `pgcrypto` + `uuid-ossp`, **full RLS** on every table.

**Enums:** `platform_kind` (the 7), `account_kind` (personal|show), `member_role` (owner|admin|editor|viewer),
`connection_status` (connected|disconnected|expired|manual_only|error), `snapshot_source` (manual|api_pull|cron|import).

**Tables:**
- `orgs` — tenant root (brand_color, logo).
- `org_members` — (org_id, user_id) PK, role; FK to `auth.users`.
- `accounts` — KM/TMMP etc. (label, tag, kind, position); unique per (org, tag).
- `platform_connections` — one row per account×platform. **AES-GCM-encrypted** `access_token_enc` /
  `refresh_token_enc`, `token_expires_at`, `status`, `last_refresh_at`, `refresh_lock_until`, `meta jsonb`.
- `snapshots` — time-series core; ~20 universal metric columns (followers, growth, views, impressions, likes,
  downloads, plays, watch_seconds, engagement_rate, …) + full `raw jsonb`.
- `posts` — top posts per snapshot (per-post metrics, `media_blob_url`/`thumb_blob_url`, rank).
- `insights` — AI output (`kind`, `output_md`, `output_json`, model, token counts).
- `recaps` — saved branded reports (template, account_ids[], layout jsonb, pdf/png blob urls).
- `cron_runs` — job audit log.
- `org_invites` (0005) — email-keyed invites; `claim_org_invites_on_signup()` trigger on `auth.users`.

**RLS helpers:** `is_org_member(org)` / `is_org_admin(org)` (security-definer) gate every table. Reads need
membership; writes typically need admin (accounts/connections) or membership (snapshots/insights/recaps).

**Functions/triggers:** `try_lock_connection_refresh` (0006), `set_updated_at()` on connections + recaps.

A hand-written TS mirror of the schema lives in `lib/supabase/types.ts` (`Database` type shaped to satisfy
postgrest-js `GenericSchema`). **Keep it in sync when you change SQL.**

---

## 9. API endpoints (quick reference)

- **Auth:** `GET /api/auth/callback` (code→session), `/api/auth/signout`.
- **Platforms:** `GET /api/platforms/[platform]/connect` (signs PKCE state, sets `kms_pkce` cookie, redirects),
  `/api/platforms/[platform]/callback`, `POST /api/platforms/captivate/manual`, `/api/platforms/spotify/set-show`.
- **Snapshots:** `GET /api/snapshots`, `POST /api/snapshots/manual` (Zod body; auto-creates a `manual_only`
  connection stub if none exists).
- **Insights:** `/api/insights`. **Recap:** `POST /api/recap/generate`, `GET /api/recap/[id]/pdf`.
- **Posts:** `POST /api/posts/upload` (Blob). **Team:** `/api/team/invite|revoke|role`.
- **Cron (Bearer `CRON_SECRET`):**
  - `GET /api/cron/weekly-snapshot` — Mon 13:00 UTC, full pull.
  - `GET /api/cron/daily-light` — daily 13:00 UTC, YouTube + TikTok only.
  - `GET /api/cron/token-health` — daily 04:30 UTC, walks all refreshable connections.

---

## 10. AI layer (`lib/ai/`)

- `claude.ts` — Anthropic client + model tiers: `MODEL_SMART = claude-opus-4-7`,
  `MODEL_BALANCED = claude-sonnet-4-6`, `MODEL_FAST = claude-haiku-4-5`.
- `insights.ts` — three generators: `generateInsight()` (Opus; current vs prior snapshot → wins/watchouts/actions),
  `generateRecapCopy()` (Sonnet; headlines, taglines, talking points), `generateContentStrategy()`
  (what's working / underperforming / try next).

When tuning the brand voice, edit the prompts in `lib/ai/insights.ts`.

---

## 11. Environment variables (`.env.example`)

Core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`TOKEN_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `ALERT_WEBHOOK_URL` (optional),
`BLOB_READ_WRITE_TOKEN`.

Per-platform OAuth creds: `SPOTIFY_CLIENT_ID/SECRET`, `YOUTUBE_CLIENT_ID/SECRET`,
`INSTAGRAM_CLIENT_ID/SECRET` (Facebook App ID/Secret), `TIKTOK_CLIENT_KEY/SECRET`,
`LINKEDIN_CLIENT_ID/SECRET`, `X_CLIENT_ID/SECRET`, `CAPTIVATE_USER_ID/API_KEY`.

---

## 12. Completion state

**Done & wired:** all 7 OAuth flows + encrypted token storage + refresh/rotation/lease-locking; snapshot
engine; all 3 cron jobs; Claude insights (3 kinds); recap generation + PDF; manual snapshot endpoint;
screenshot upload; team invites + RLS; charts; dashboard overview. The source is essentially free of
`TODO`/`FIXME` markers (the only "stub" is the deliberate `manual_only` connection stub in `/api/snapshots/manual`).

**Intentional gaps (external platform limits, not unfinished code):**
- **LinkedIn** personal-profile post analytics aren't exposed without enterprise access → no `refresh`,
  drops to `manual_only`, manual entry expected.
- **TikTok** Display API is research-only by default → needs Production approval in the dev portal.
- **X** tweet analytics require the paid Basic tier (~$100/mo).

---

## 13. Gotchas / known drift (read before debugging)

- **Login is password-based in code** (`app/login/page.tsx` uses `signInWithPassword`) even though the README
  and architecture diagram say "magic-link." The `/api/auth/callback` code-exchange path still exists.
- **Dev port mismatch:** `npm run dev` runs on **3001**, but README/OAuth setup docs reference **3000** for
  redirect URIs. Align your OAuth redirect URIs with whichever port you actually run.
- **Two lockfiles committed** (`package-lock.json` + `pnpm-lock.yaml`). Use npm to avoid drift.
- **Admin client bypasses RLS** — never return its data to a user without an explicit membership check.
- **Migration 0006 must be applied** for refresh locking to actually serialize (otherwise it degrades to no-lock).

---

## 14. Where to start when extending

1. `lib/platforms/types.ts` — the adapter interface every platform implements.
2. `lib/snapshot-engine.ts` — `pullSnapshotForConnection()` / `pullAllForOrg()`, the pull+persist heart.
3. `lib/token-manager.ts` — token lifecycle (see §6 — handle with care).
4. `lib/ai/insights.ts` — AI prompts / brand voice.
5. `app/dashboard/page.tsx` + `lib/dashboard-data.ts` (`loadOverview()`) — overview composition.
6. `supabase/migrations/0001_init.sql` — fully commented schema.
