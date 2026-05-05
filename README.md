# Casino Prototype

Virtual-currency social casino prototype built with React, TypeScript, and Vite.

This project is demo-only. Gold Coins and Bonus Coins have no cash value. There are no real-money deposits, withdrawals, prizes, redemptions, cashout flows, sweepstakes flows, Supabase integration, or payment processing.

## Setup

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

On Windows, you can also double-click:

```text
start-casino.bat
```

## Build

```bash
npm run build
```

## Mobile App Packaging With Capacitor

Capacitor is configured for iOS and Android packaging while keeping the Vite web
build and Vercel deployment unchanged.

Current placeholders:

- App name: `Casino Prototype`
- Bundle/package id: `com.example.casino`
- Web directory: `dist`
- Icon/splash source placeholders: `resources/icon.svg` and `resources/splash.svg`

Before a real store build, replace `com.example.casino` with the final iOS
bundle id and Android package name. Because the native projects are already
generated, update both `capacitor.config.ts` and the native project settings
(`ios/App/App.xcodeproj` product bundle identifier, plus Android
`namespace`/`applicationId`). Replace the placeholder mobile artwork in
`resources/`.

Build and sync native projects:

```bash
npm run mobile:sync
```

Open native projects:

```bash
npm run mobile:open:ios
npm run mobile:open:android
```

iOS requires macOS with Xcode installed. Android requires Android Studio and a
configured Android SDK.

After changing web code, run:

```bash
npm run build
npm run mobile:sync
```

This mobile setup does not enable real payments, cashout, prizes, withdrawals,
or redemption behavior.

### Manual Phone QA

- Launch on iPhone and Android from a clean install.
- Confirm the app opens to the auth/demo flow without a browser address bar.
- Check portrait and landscape on notched devices.
- Verify top headers and bottom tabs respect safe areas.
- Confirm pages do not pinch zoom or horizontally scroll.
- Play each game briefly using Gold Coins and Bonus Coins.
- Open store flows and confirm they remain demo-only.
- Open redemption/prep pages and confirm redemption stays disabled.
- Kill and relaunch the app, then confirm local session/wallet display restores.
- Run one slow-network pass and confirm loading/error states remain usable.

## Tests

```bash
npm run test:dev
```

Individual test commands:

```bash
npm run test:wallet
npm run test:slots
```

## Demo Admin

```text
Email: admin@demo.local
Password: admin123
```

## Deployment Notes

This app is ready for static deployment on Vercel using the Vite defaults:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No environment variables are required for the current localStorage-only prototype.

## Optional Supabase Backend And Auth

Supabase support is optional and gradual. If `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` are missing, the app automatically keeps using the
local mock auth and localStorage.

When Supabase env vars exist, the app uses Supabase Auth for signup, login,
logout, and session restore. The current data migration persists:

- auth profile records
- wallet balances
- wallet transactions

Other product systems still use localStorage for now.

Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL
editor before enabling Supabase environment variables.

Environment variables for local `.env.local` or Vercel:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Supabase Auth settings for local/prototype testing:

- Authentication > Providers > Email: enable Email provider.
- For immediate prototype signup/login, disable email confirmations. If email
  confirmations stay enabled, users must confirm email before logging in.
- Authentication > URL Configuration:
  - Site URL: your Vercel URL or `http://127.0.0.1:5173`
  - Redirect URLs: add `http://127.0.0.1:5173/**` and your Vercel URL.

To make your Supabase user an admin manually, run this after signing up:

```sql
update public.profiles
set role = 'ADMIN',
    roles = array['USER', 'ADMIN']
where email = 'you@example.com';
```

Admin tooling should later move to server-side routes or Edge Functions using
service-role credentials. Never expose service-role keys in this client app.
