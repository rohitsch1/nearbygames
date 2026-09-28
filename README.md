# nearbygames

Find or start a pickup game near you. Football, cricket, badminton, chess, FIFA nights: anyone can drop a game on the map, and anyone nearby can find it and join.

> **Free games are a request. Paid games are a transaction.**
> A free game never lets you skip the host's yes. A paid game never makes you wait for one.
> This rule is enforced in the **database** (Postgres functions and row-level security). The UI only reflects it.

## Stack

| Part | Choice | Why |
|---|---|---|
| Web framework | **Next.js 16** (App Router, Turbopack, Server Actions), TypeScript | SSR/ISR for SEO, one codebase |
| Styling | **Tailwind CSS v4**, self-hosted Plus Jakarta Sans | Responsive (mobile → tablet → desktop), light and dark mode |
| Database / auth / realtime / storage | **Supabase** (free tier): Postgres + PostGIS, Auth, Realtime, Storage | "Games near me" is one PostGIS query. Chat is realtime |
| Maps | **Google Maps JS API** (`@vis.gl/react-google-maps`), Advanced Markers, Places (New), Geocoding | |
| Payments | **Razorpay** (test mode), in-app wallet, pay in person | |
| Hosting | **Vercel** (free tier) | |

## What's built

- **Sign in**: email one-time code and Google (built). Phone OTP is built but switched off by a flag until an SMS provider is added. Apple is behind a flag.
- **6-box code screen**: auto-submits on the 6th digit, supports paste and SMS autofill, 30 s resend countdown.
- **Complete your profile** (skippable): photo (compressed to WebP in the browser), name, neighbourhood (can be located and is rounded to about 100 m), occupation, ID-check toggle.
- **Welcome tour**: free vs paid explained, pick your sports, location permission with a privacy note.
- **Map (home)**: live markers per sport, the nearest one bigger, paid ones amber. Filters: "Next 2 hours", "Free only", and per sport. Place search, recenter button, summary card and "Start a game". A list view on mobile and a side list on tablet and desktop.
- **Game page**: server-rendered with `SportsEvent` + breadcrumb JSON-LD and a dynamic OG image. The call-to-action switches between 6 states (own game, you're in, full, paid → pay, request pending → withdraw, free → note + ask), plus signed-out, declined, cancelled and ended.
- **Pay for a spot**: share + platform fee (5%, min ₹5, max ₹50). Wallet and pay-in-person work for real; UPI and card go through Razorpay Checkout.
- **Start a game**: sport, photo, drag-the-map pin or current location, spot name and city (city filled from geocoding), date and time in IST, duration, players, free/paid + fee, notes.
- **Requests**: "To your games" shows reliability badge, coarse distance band and note, with Accept/Decline (optional reason). "You asked to join" lists each request with its status, a withdraw button while pending, and a chat link once accepted. A live bell badge shows pending requests.
- **Messages**: a conversation list with unread counts. Pending free games show as **locked rows**, because a chat only exists once you're in.
- **Chat**: realtime, optimistic sending (deduplicated by `client_id`), retry on failure, loads older messages on scroll.
- **Me**: stats (played / hosted / no-shows), a verification progress bar showing what it unlocks, wallet + transactions + top-up, upcoming and past games, sports, notifications toggle, replay tour, sign out.
- **Host tools**: mark no-shows once the game has started. Cancelling a game refunds paid players to their wallets.
- **In-app pings**: realtime toasts, plus system notifications when the tab is in the background and permission was granted.

### SEO

- Public, indexable pages: `/` (landing with FAQPage JSON-LD), `/play`, `/play/[sport]`, `/play/[sport]/[city]` (ISR every 5 min; empty non-featured cities are `noindex`), and `/games/[slug]` (SSR). The map is public too, and actions ask you to sign in.
- `sitemap.xml` covers static pages, sports, featured cities and every city that has games, and all upcoming games. `robots.txt` keeps private routes out. Every page has a canonical URL. OG and Twitter images are generated.
- Web app manifest, icons, `theme-color`, and past or cancelled games switch to `noindex`.

### Privacy and security model

- A user's live location **never leaves the device**. It only centres the map and computes distances on the device. The saved neighbourhood is rounded to about 100 m and only its owner can read it (`profile_private`, owner-only RLS).
- Hosts see a coarse **distance band** ("1–3 km") that is fixed when the request is made. A game's pin can't be moved once anyone has asked or joined, so a host can't triangulate someone's home.
- Chats are readable only by their two members. A player can't see who else has joined a game unless they are in it (a per-game roster function).
- Money moves only inside `SECURITY DEFINER` functions, atomically and with row locks. Payment confirmation is idempotent: a payment is processed only while it is pending.
- The client can't write `players_count`, `status`, the fee, the host, wallets, payments or participants (column grants plus RLS). EXECUTE on every function is revoked, then granted back per role.
- Open-redirect-safe `?next=` handling, Razorpay signatures checked with HMAC and a constant-time compare, security headers in `next.config.ts`.

## Run it

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase (free)

1. Create a project at [supabase.com](https://supabase.com). Choose the Mumbai (ap-south-1) region for India.
2. Apply the schema, either way works:
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`
   - **Dashboard:** SQL Editor → paste `supabase/migrations/20260928000000_init.sql` → Run
3. **Authentication → Sign In / Providers → Email**: enable it, turn **Confirm email on**, set OTP length to **6**.
4. **Authentication → Emails → Templates**: paste `supabase/templates/otp.html` into both **Magic Link** and **Confirm signup**. The app verifies a 6-digit code (`{{ .Token }}`), not a link.
5. **Authentication → URL Configuration**: Site URL = your domain. Add redirect URLs `https://YOUR_DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`.
6. **Google sign-in**: create an OAuth client in Google Cloud (Web). Authorised redirect URI = `https://<ref>.supabase.co/auth/v1/callback`. Paste the client ID and secret into Supabase → Providers → Google.
7. **Custom SMTP** (strongly recommended for production): the built-in mailer is rate-limited to a few emails per hour. Brevo and Resend both have free tiers. Set it under Authentication → SMTP.
8. Copy the Project URL, the publishable key and the secret key into `.env.local`.

### 3. Google Maps

In Google Cloud, enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API**. Create an API key **restricted by HTTP referrer** (your domain + `localhost:3000`). Then Map Management → create a **JavaScript Map ID** (vector) and set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Without a key, the app falls back to a list view.

### 4. Razorpay (optional, test mode)

Dashboard → Test mode → API keys → set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Webhooks → add `https://YOUR_DOMAIN/api/webhooks/razorpay` with events `payment.captured` and `payment.failed`, and set `RAZORPAY_WEBHOOK_SECRET`. Without keys, UPI and card payments are recorded as **pending** (the documented placeholder behaviour).

### 5. Develop

```bash
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test             # unit tests (vitest)
DATABASE_URL=postgres://… npm run test:db   # migration + rule tests on an empty Postgres with PostGIS
```

With Docker you can run the whole stack locally: `npx supabase start` (uses `supabase/config.toml` and seeds demo games from `supabase/seed.sql`), then point `.env.local` at `http://127.0.0.1:54321`. OTP emails show up in the local Mailpit inbox.

### 6. Deploy (Vercel)

Import the repo and add every variable from `.env.example`. Set `NEXT_PUBLIC_SITE_URL` to the production URL; canonical URLs, the sitemap and OG images depend on it. After the first deploy, submit `https://YOUR_DOMAIN/sitemap.xml` in Google Search Console.

## Project layout

```
src/
  app/
    (marketing)/     landing, /play SEO pages, privacy, terms
    (auth)/sign-in   sign in + code
    (app)/           map, games/[slug] (+pay, OG image), host/new, requests, messages, me
    onboarding/      profile + welcome tour
    actions/         server actions (zod-validated → Postgres RPCs)
    api/             Razorpay order / verify / webhook
    auth/            OAuth callback, post-sign-in router, sign out
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx
  components/        ui/, map/, game/, chat/, auth/, layout/
  lib/               supabase clients, queries, money, geo, format, sports, SEO helpers
  proxy.ts           session refresh + route protection (Next 16 "proxy" = middleware)
supabase/
  migrations/        full schema, RLS, RPCs, storage buckets, realtime
  tests/             SQL tests for the core rules (run in CI)
  seed.sql           demo data for local development
```

## Placeholders and next steps

- **ID check** is a self-declared toggle, as in the spec. Plug in a KYC provider (DigiLocker, HyperVerge) and set `id_verified` from a server webhook only.
- **Phone OTP**: add Twilio or MSG91 under Supabase Auth → Phone, then set `NEXT_PUBLIC_ENABLE_PHONE_AUTH=true`.
- **Push notifications when the app is closed**: add a service worker + Web Push (VAPID). The `notifications` table already records every event.
- **Host payouts** from the wallet to a bank account (RazorpayX), and switching Razorpay to live after KYC.
- Before launch: moderation and reporting, error tracking (Sentry), a legal review of `/privacy` and `/terms` (DPDP Act 2023).
