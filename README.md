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
