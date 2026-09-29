# Setup & deployment

Everything you need to run nearbygames locally and ship it to production. Back to the [README](../README.md).

## Run it locally

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

Dashboard → Test mode → API keys → set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Webhooks → add `https://YOUR_DOMAIN/api/webhooks/razorpay` with events `payment.captured` and `payment.failed`, and set `RAZORPAY_WEBHOOK_SECRET`. Without keys, UPI and card payments are recorded as **pending** (the documented placeholder behaviour). Keys are read when each payment starts, so restarting the server is enough after you change them.

**UPI (QR, Google Pay / PhonePe / Paytm, UPI ID):** Checkout puts UPI first, but Razorpay only shows it once it's enabled for your account. Submit your KYC details under **Account & Settings**, then turn on UPI under **Payment Methods** (ask Razorpay support if it isn't listed). In test mode, use UPI ID `success@razorpay` (or `failure@razorpay`) and card `4111 1111 1111 1111`.

### 5. Develop

```bash
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test             # unit tests (vitest)
DATABASE_URL=postgres://… npm run test:db   # migration + rule tests on an empty Postgres with PostGIS
```

With Docker you can run the whole stack locally: `npx supabase start` (uses `supabase/config.toml` and seeds the Hisar demo games from `supabase/seed.sql`), then point `.env.local` at `http://127.0.0.1:54321`. OTP emails show up in the local Mailpit inbox.

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


## Privacy and security model

- A user's live location **never leaves the device**. It only centres the map and computes distances on the device. The saved neighbourhood is rounded to about 100 m and only its owner can read it (`profile_private`, owner-only RLS).
- Hosts see a coarse **distance band** ("1–3 km") that is fixed when the request is made. A game's pin can't be moved once anyone has asked or joined, so a host can't triangulate someone's home.
- Chats are readable only by their two members. A player can't see who else has joined a game unless they are in it (a per-game roster function).
- Money moves only inside `SECURITY DEFINER` functions, atomically and with row locks. Payment confirmation is idempotent: a payment is processed only while it is pending.
- The client can't write `players_count`, `status`, the fee, the host, wallets, payments or participants (column grants plus RLS). EXECUTE on every function is revoked, then granted back per role.
- Open-redirect-safe `?next=` handling, Razorpay signatures checked with HMAC and a constant-time compare, security headers in `next.config.ts`.

