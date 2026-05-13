# OAuth Setup — All 7 Platforms

Each platform requires you to create a "developer app" so we can ask users to authorize us. This is the same thing apps like Buffer, Later, Hootsuite, etc., do.

**Estimated time:** 30–60 min total. Spotify + YouTube + LinkedIn are the easiest. Instagram and TikTok take a bit longer because Meta + ByteDance want app review for full access.

For every platform below, the **Redirect URI** you set must match exactly:

```
https://your-domain.vercel.app/api/platforms/<platform>/callback
```

(plus `http://localhost:3000/api/platforms/<platform>/callback` for dev)

---

## 1) Spotify

1. Go to https://developer.spotify.com/dashboard → Create app.
2. App name: "KM Socials Command Center". Description: "Internal analytics dashboard".
3. Website: `https://your-domain.vercel.app`.
4. Redirect URI: `https://your-domain.vercel.app/api/platforms/spotify/callback`
5. Hit Save → Settings tab → copy **Client ID** and **Client Secret**.

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

**Note:** Spotify for Podcasters does NOT have a public analytics API. We pull show metadata + episode list. Per-episode play counts come from Captivate (which IS our podcast host).

---

## 2) Captivate.fm

Captivate is API-key based, no OAuth needed.

1. Log into https://captivate.fm → Account → Integrations.
2. Generate an API key.
3. Find your User ID in the URL when viewing your dashboard.

```
CAPTIVATE_USER_ID=...
CAPTIVATE_API_KEY=...
```

---

## 3) YouTube (Google Cloud)

1. Go to https://console.cloud.google.com → New project → "KM Socials".
2. **APIs & Services → Library** → enable:
   - YouTube Data API v3
   - YouTube Analytics API
3. **OAuth consent screen**:
   - User type: External (it'll be in "testing" mode, that's fine — add Kyle's email + your email as Test Users)
   - App name: KM Socials
   - Scopes: `youtube.readonly`, `yt-analytics.readonly`
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized redirect URIs: `https://your-domain.vercel.app/api/platforms/youtube/callback` + localhost equivalent
5. Copy Client ID & Secret.

```
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
```

---

## 4) Instagram (Meta for Developers)

⚠️ Requires Instagram Business or Creator account connected to a Facebook Page.

1. Go to https://developers.facebook.com/apps → Create App → "Business" type.
2. App name: KM Socials. Contact email: yours.
3. Add Product: **Instagram Graph API**.
4. Settings → Basic — note App ID and App Secret.
5. **App Roles → Roles** — add Kyle (and you) as Testers if account is still in Development mode.
6. **Use Cases → Instagram → Settings → Valid OAuth Redirect URIs**:
   - `https://your-domain.vercel.app/api/platforms/instagram/callback`
7. For production use, submit for App Review with requested permissions: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`.

```
INSTAGRAM_CLIENT_ID=...        # actually the Facebook App ID
INSTAGRAM_CLIENT_SECRET=...    # App Secret
```

---

## 5) TikTok

1. Go to https://developers.tiktok.com/apps → Connect → Create App.
2. App info → fill in basics → submit.
3. Once approved (~24h), open the app → Add Products:
   - Login Kit
   - User Info & Stats
   - Video List
4. Configure Login Kit:
   - Web platform
   - Redirect URI: `https://your-domain.vercel.app/api/platforms/tiktok/callback`
5. Note **Client Key** and **Client Secret**.

```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

---

## 6) LinkedIn

1. Go to https://www.linkedin.com/developers/apps → Create app.
2. Associate it with a Company Page (any Page you admin).
3. Settings → Auth tab:
   - Redirect URLs: `https://your-domain.vercel.app/api/platforms/linkedin/callback`
4. Products → request **Sign In with LinkedIn using OpenID Connect** (and only that — do NOT also add the legacy "Sign In with LinkedIn" product, the two issue different scope sets and LinkedIn will reject mixed requests).
5. Note Client ID & Client Secret. The OAuth scopes used by this app are `openid profile email`.

> ⚠️ LinkedIn tokens don't refresh in this OpenID-Connect flow. When the token
> expires the connection moves to `manual_only` (last-known numbers stay on
> the dashboard, and you can keep adding rows via **Manual snapshot**); to
> resume pulls just hit **Reconnect** in Settings.

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

⚠️ **Personal-profile post analytics are not available** in the public Marketing API without enterprise access. Use the manual snapshot endpoint to enter follower counts + impressions until Marketing Developer access is granted.

---

## 7) X (Twitter)

1. Go to https://developer.x.com/en/portal/dashboard → Apply for access.
2. **Free** tier is read-only, very limited. **Basic ($100/mo)** is required for tweet metrics on others' tweets and decent rate limits.
3. Once you have a project + app:
   - Authentication settings → OAuth 2.0:
     - Type of App: Web App
     - Callback URI: `https://your-domain.vercel.app/api/platforms/x/callback`
     - Website URL: `https://your-domain.vercel.app`
4. Copy **OAuth 2.0 Client ID and Client Secret**.

```
X_CLIENT_ID=...
X_CLIENT_SECRET=...
```

---

## After all credentials are in Vercel

```bash
vercel --prod
```

Then in the app: **Settings** → each platform → **Connect**. Authorize each one. Test by clicking **Pull fresh snapshot** on a platform card.

---

## Go-live checklist (do this BEFORE relying on "always connected")

Most OAuth providers default new apps to a Testing / Sandbox / Development mode that silently kills refresh tokens after a short window. The daily token-health cron in this app refreshes everything proactively, but if your apps are stuck in test mode the refresh tokens themselves will be revoked by the platform. You must promote each app once.

| Platform | What to do | Why it matters |
|---|---|---|
| **Google (YouTube)** | OAuth consent screen → **Publish app** (Production status). If your scopes require verification, complete the verification (1–4 weeks). | In "Testing" mode, refresh tokens expire after **7 days**. In Production they last indefinitely. |
| **Meta (Instagram)** | App Dashboard → **Switch app to Live mode**. Submit App Review for `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`. | In Development mode only listed Testers can use the app; tokens for non-testers are immediately blocked. |
| **TikTok** | App Dashboard → submit for **Production** (out of Sandbox). | Sandbox apps cap at ~25 users and may have shorter refresh-token TTLs. |
| **LinkedIn** | If you want long-lived refresh tokens, enrol in the **Community Management API** (or Marketing Developer Platform) product. Standard "Sign In with LinkedIn" tokens are 60 days, no refresh. | Without an enrolled refresh-token product the connection drops to `manual_only` every 60 days. |
| **X** | Project → set tier to **Basic ($100/mo)**. Add `offline.access` to scopes (already in this codebase). | Without `offline.access` no refresh token is issued and tokens die in 2 hours. |
| **Spotify** | App Dashboard → **Extended Quota Mode** (out of Development Mode). | Development Mode caps at 25 users; Quota Mode removes the cap. |
| **Captivate** | No OAuth — just don't rotate the API key. | If you rotate the key, update `CAPTIVATE_API_KEY` in Vercel env vars. |

Start the review submissions early — Google verification and Meta App Review each can take weeks.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "redirect_uri_mismatch" | The URI in the platform's app config doesn't exactly match. Re-check trailing slashes. |
| "invalid_client" | Client ID/Secret typo. Re-copy from platform dashboard. |
| Token refresh failing | Some platforms require re-authorization annually. Click Reconnect. |
| 401 on snapshot pull | Token expired and auto-refresh failed. Reconnect that platform. |
| Instagram returns empty | IG account isn't Business/Creator, or the FB Page isn't linked. |
| TikTok works in dev but not production | Submit for "Production" mode in TikTok dev console. |
| YouTube refresh dies after 7 days | OAuth consent screen still in "Testing". Publish the app. |
| X refresh returns 400 invalid_grant | Concurrent refresh stole the rotation. The lease lock in `lib/token-manager.ts` prevents this — if you're seeing it, run migration `0006_token_refresh_locks.sql`. |
| All tokens fail with decryption errors | `TOKEN_ENCRYPTION_KEY` rotated. Restore the original value or re-authorize every platform. |
