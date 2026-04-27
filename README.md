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
