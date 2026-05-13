# KM Socials · Command Center

Production analytics platform for Kyle Matthews + The Matthews Mentality Podcast across **Spotify, Captivate, YouTube, Instagram, TikTok, LinkedIn, and X**.

This is the real thing — a multi-tenant Next.js 14 app with Supabase auth + Postgres, encrypted OAuth tokens, scheduled cron jobs, Claude AI insights, and branded recap exports.

---

## What it does

| Capability | How |
|---|---|
| Pull live stats from 7 platforms | OAuth 2.0 per platform, refresh-token rotation, AES-GCM token storage |
| Snapshots over time | Every pull writes a row in `snapshots` — full history, never overwritten |
| Auto-snapshot every Monday | Vercel scheduled function `/api/cron/weekly-snapshot` (13:00 UTC = 9am EDT / 8am EST) |
| Daily lightweight follower curve | YouTube + TikTok pulled every day (`/api/cron/daily-light`) |
| Daily token health + auto-refresh | `/api/cron/token-health` (04:30 UTC) refreshes any token within its per-platform lead window, flips status, alerts on failure |
| Strategic AI insights | Claude Opus analyzes current vs prior snapshot, names wins/watchouts, gives specific actions |
| Auto-generated recap copy | Headlines, taglines, meeting talking points |
| Content strategy suggestions | "What's working / underperforming / try this next" |
| Branded recap pages (Canva replacement) | `/dashboard/recap` — multi-page templates, print-to-PDF, save to DB |
| Drag-drop post screenshots | Vercel Blob storage, attached to specific posts |
| Multi-user team sync | Supabase Auth + RLS by org membership |
| Real-time live updates | Supabase Realtime (built in — wire to UI as needed) |

---

## Architecture

```
Browser (Next.js App Router, React Server Components)
   │
   ├── Supabase Auth (magic-link)
   │
   ├── Server actions / API routes  ─► Supabase Postgres (RLS-enforced)
   │                                ─► Vercel Blob (post screenshots)
   │                                ─► Anthropic API (Claude Opus + Sonnet + Haiku)
   │                                ─► 7 platform APIs (OAuth)
   │
   └── Vercel Cron ─► /api/cron/weekly-snapshot   (Mon 13:00 UTC = 9am EDT / 8am EST)
                  └─► /api/cron/daily-light       (every day 13:00 UTC)
```

### Folder structure
```
app/                    # Next.js App Router pages
  dashboard/            # The protected app (auth required)
    page.tsx            # Overview with KM/TMMP toggle
    insights/           # AI-generated insights
    recap/              # Recap Studio
    platform/           # Per-platform deep-dive
    settings/           # OAuth connections
  api/                  # Server routes
    auth/               # Magic link callback
    platforms/          # OAuth per platform
    snapshots/          # Pull + read time-series
    insights/           # Claude AI endpoints
    recap/              # Save recap definitions
    posts/upload/       # Vercel Blob image upload
    cron/               # Scheduled jobs
lib/
  supabase/             # Server & client SDK wrappers
  platforms/            # 7 platform adapters, common interface
  ai/                   # Claude wrappers (insights, recap copy, strategy)
  crypto.ts             # AES-256-GCM for stored tokens
  snapshot-engine.ts    # Core "pull + persist" worker
  dashboard-data.ts     # Composite loader for overview page
components/
  layout/               # TopBar
  dashboard/            # Platform cards, hero, switcher
  charts/               # Recharts wrappers
  recap/                # Recap pages renderer
supabase/
  migrations/           # SQL — run via `supabase db push`
```

---

## Deploy in 30 minutes

You need three accounts: **Supabase**, **Vercel**, **Anthropic**. Free tiers cover everything until you scale up.

### 1) Clone & install

```bash
git clone <this folder>
cd km-socials-platform
npm install
cp .env.example .env.local
```

### 2) Set up Supabase

1. Go to https://supabase.com → New project. Pick a region near your users (US East is fine).
2. Wait ~2 min for provisioning.
3. **Settings → API** — copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)
4. **SQL Editor** — paste `supabase/migrations/0001_init.sql`, run it.
5. Then paste `supabase/migrations/0002_seed.sql` — but read the comments first; you'll uncomment the `org_members` insert once you've signed up.
6. **Authentication → Email** — turn on "Enable Email provider". Site URL = `https://your-domain.vercel.app` (or `http://localhost:3000` for dev). Redirect URLs = `https://your-domain.vercel.app/api/auth/callback`.

### 3) Generate encryption keys

```bash
# Token encryption — for storing OAuth refresh tokens
openssl rand -base64 32
# → paste into TOKEN_ENCRYPTION_KEY

# Cron secret — protects scheduled function endpoints
openssl rand -base64 32
# → paste into CRON_SECRET
```

### 4) Anthropic API key

1. Go to https://console.anthropic.com/settings/keys → Create Key.
2. Add a payment method (~$5 minimum). Claude Opus runs ~$0.02 per insight.
3. Paste into `ANTHROPIC_API_KEY`.

### 5) Deploy to Vercel

```bash
npm i -g vercel
vercel
```

When prompted:
- Project name: `km-socials`
- Framework: detected as Next.js
- Don't override build command

After deploy:
- **Vercel dashboard → Settings → Environment Variables** — paste every var from your `.env.local`.
- **Vercel dashboard → Storage → Blob → Create new** — copy the `BLOB_READ_WRITE_TOKEN` into your env vars too.
- **Vercel dashboard → Crons** — confirm the two crons in `vercel.json` are scheduled (they auto-register on deploy).

### 6) Sign in & seed your account

1. Visit `https://your-domain.vercel.app/login`. Enter your email. Click the link.
2. Once you're signed in, find your user ID in Supabase → Authentication → Users.
3. SQL Editor → run:
   ```sql
   insert into public.org_members (org_id, user_id, role)
   values ('00000000-0000-0000-0000-000000000001', '<YOUR_USER_ID>'::uuid, 'owner');
   ```
4. Refresh the app. You should see KM + TMMP accounts with 7 platform cards each.

### 7) Connect your first platform

The KM data from the May 6 SM Meeting is already seeded, so the UI is alive immediately. To wire up live pulling:

1. Pick a platform that you've used before — **YouTube** is the easiest because Google's OAuth console is straightforward.
2. Read `OAUTH_SETUP.md` (next section). Each platform has its own 3–5 step app-creation flow.
3. Once you have the `CLIENT_ID` + `CLIENT_SECRET`, paste them into Vercel env vars and redeploy.
4. In the app, **Settings → KM → YouTube → Connect**. Authorize. Click **Pull fresh snapshot** on the YouTube card.

Repeat for the other six platforms.

---

## Token health (always connected)

You authorize each platform once and the app keeps every connection alive forever. Here's how that works and what you have to do.

### How it works

`lib/token-manager.ts` is the single helper every code path uses to get an access token. It:

1. Reads `platform_connections`, checks if the token will expire within its per-platform "lead window" (5 min for Spotify/YouTube/X, 10 min for TikTok, 14 days for Instagram).
2. If so, acquires a row-level lease lock via `try_lock_connection_refresh(...)` so two workers can't race a refresh — critical for X and TikTok where the refresh token rotates on every call.
3. Calls the adapter's `refresh()`, persists the new tokens (rotated refresh token first), flips status back to `connected` if needed.
4. On `invalid_grant` / 401 → marks the row `expired`, stores the error, and posts to `ALERT_WEBHOOK_URL`.

`/api/cron/token-health` runs daily at 04:30 UTC and walks every refreshable connection through this helper, so even idle connections stay warm.

### What you have to do (one-time, in order)

1. **Run migration `0006_token_refresh_locks.sql`** alongside the others (`supabase db push` will do this).
2. **Set `ALERT_WEBHOOK_URL`** (optional but strongly recommended) in Vercel env vars. Slack incoming webhook, Discord webhook with `/slack` suffix, or any Zapier/Make webhook works.
3. **Push your OAuth apps out of Testing/Sandbox** before the initial connect — Google OAuth consent screen → Production, Meta app → Live mode, TikTok app → Live (app review). Skipping this kills tokens after 7 days. See `OAUTH_SETUP.md`.
4. **Authorize each platform once.** Visit `/dashboard/settings` and click Connect on each tile. From here on, you should not need to touch them again.
5. **Watch the Settings page.** Each tile shows a status pill (green/amber/red), the time until the token expires, the last refresh, and any error. If anything flips to red, the alert webhook will tell you and the "Reconnect" button is right there.

### Critical: `TOKEN_ENCRYPTION_KEY` is immutable in production

Every stored OAuth token is AES-GCM encrypted with this key. **If you ever rotate it, every connection becomes garbage** and every platform must be re-authorized from scratch. Set it once at first deploy and never change it. If you must rotate (key compromise), plan for a coordinated re-auth of all platforms.

---

## Cost expectations

| Service | Free tier | When you exceed it |
|---|---|---|
| Vercel Hobby | 100 GB-hrs / 100 GB bandwidth | $20/mo Pro |
| Supabase Free | 500 MB DB, 1 GB storage | $25/mo Pro |
| Anthropic API | n/a (pay as you go) | ~$0.02 per insight × 4/mo = $0.08 |
| Vercel Blob | 500 MB free | $0.15/GB after |
| Platform APIs | All free except X | X "Basic" tier is $100/mo |

**Reality check:** you'll likely pay $0–25/mo for 6+ months. If you hit Supabase Pro it's because you have real history (years of snapshots × posts).

---

## What's wired vs what you'll wire

| ✅ Built | ⚙️ Stubbed / needs your input |
|---|---|
| All 7 OAuth flows + token storage | Real platform credentials in env |
| Snapshot engine + cron | (works on deploy) |
| Claude AI insights (3 kinds) | (works on deploy with API key) |
| Recap Studio + print PDF | (works on deploy) |
| Manual snapshot entry endpoint | UI on overview is "Pull"; "Manual" UI is one form away |
| Drag-drop screenshot upload | Endpoint exists; UI hook lives in `/api/posts/upload` |
| Multi-user RLS | Auth works; team invite UI is one page away |
| Time-series charts | (works — fully functional) |

Areas explicitly left as TODOs to keep scope tight on launch:
- LinkedIn personal-profile post analytics (LinkedIn doesn't expose these without enterprise access — manual entry is supported).
- TikTok Display API is "research-only" by default — submit for "Production" access in dev portal once active.
- X Basic tier required for tweet analytics.

---

## Local development

```bash
cp .env.example .env.local
# Fill in Supabase + Anthropic keys at minimum
npm run dev
```

For OAuth callbacks in dev, set redirect URIs in each platform app to `http://localhost:3000/api/platforms/<platform>/callback`.

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # next lint
```

---

## Files to read first

If you (or another dev) need to extend this:

1. `lib/platforms/types.ts` — every platform implements this interface
2. `lib/snapshot-engine.ts` — the heart: pulls + persists
3. `lib/ai/insights.ts` — the AI prompts (tweak voice here)
4. `app/dashboard/page.tsx` — overview composition
5. `supabase/migrations/0001_init.sql` — the schema, fully commented

---

## License

Proprietary. Built for Matthews Mentality.
