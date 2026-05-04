# Manual QA Checklist

Final release-cleanup checklist for the virtual-coin prototype. Redemptions must remain disabled.

## Auth
- Register a new test user and confirm the session starts.
- Log out and log back in with the same test user.
- Confirm invalid credentials show a clear error.
- Confirm admin-only pages are hidden for non-admin users.
- Confirm ADMIN users can open Admin without breaking user pages.

## Supabase
- With Supabase env configured, register/login and confirm auth state persists after refresh.
- With Supabase env missing, confirm local prototype mode still works.
- Confirm no Supabase error appears in the browser console on app load.
- Confirm demo wallet changes persist through the configured storage path.

## Wallet & Store
- Open Wallet and confirm Gold Coins and Sweeps Coins balances are prominent.
- Confirm Gold Coins copy says they have no cash value.
- Tap the header `+` from Lobby, Rewards, Account, and Admin; confirm Purchase Coins opens without navigating away.
- Confirm the header `+` is not visible while inside an active game screen.
- Confirm purchase packs show the configured Gold/Sweeps values:
- Starter Pack: 5,000 Gold Coins plus 25 promotional Sweeps Coins.
- Value Pack: 25,000 Gold Coins plus 125 promotional Sweeps Coins.
- Mega Pack: 75,000 Gold Coins plus 375 promotional Sweeps Coins.
- Confirm demo purchase credits Gold once and promotional Sweeps once.
- Confirm direct purchase of Sweeps Coins is not offered.
- Open Transaction History and confirm filters work for All, Purchases, Bonuses, Bets, and Wins.
- Open a transaction detail and confirm metadata is readable.
- Export JSON and confirm it downloads a ledger file.

## Redemption Disabled
- Open Wallet > Redemption Status.
- Confirm the modal says prototype redemptions are not currently enabled.
- Confirm the request button is disabled.
- Confirm minimum redemption is placeholder-only.
- Confirm KYC shows placeholder status only.
- Confirm request history says creation is disabled.
- Open `/redemption` directly and confirm it opens the same disabled status view.
- Confirm no form can submit a redemption request.
- Confirm no copy says Sweeps Coins can be redeemed now.

## Games
- Frontier Fortune: route loads, spin debits once, win credits once, result banner appears, sound toggle works.
- Blackjack: route loads, bet debits once, win/push/loss settles once, split/double/insurance controls do not create duplicate credits.
- Roulette: route loads, chips place bets, spin resolves once, winning bets glow, multi-bet total respects caps.
- Over/Under: route loads, target slider changes payout, roll settles once, min/max bet validation works.
- Crash: route loads, start debits once, collect before crash credits once, crashed rounds do not credit.
- Treasure Dig: route loads, 20 coin minimum bet is enforced, safe picks increase multiplier, trap settles as loss, collect credits once.
- Brick Break Bonus: route loads, play debits once, final brick reveal credits once, replay starts a new ledger sequence.
- Balloon Pop: route loads, play debits once, each round resolves once, final payout credits once.

## Admin QA
- Open Admin as ADMIN.
- Run all RNG simulations.
- Confirm observed RTP values are finite.
- Confirm Treasure Dig observed RTP is roughly 88% to 94%.
- Confirm warning appears for any RTP above 95%.
- Confirm max win, max payout cap hits, and cap hit rate are visible.
- Confirm future redemption/KYC/Sweeps grant admin sections are read-only or disabled.
- Confirm QA checklist page shows auth, Supabase, wallet, simulations, mobile, and compliance gates.

## Mobile Layout
- Test viewport width 320px.
- Test viewport width 375px.
- Test viewport width 390px.
- Test viewport width 414px.
- For each size, confirm no horizontal overflow.
- For each size, confirm sticky bottom nav does not cover primary controls.
- For each size, confirm modals fit within the viewport and scroll.
- For each size, confirm Wallet balance cards, Purchase modal, Redemption modal, and Transaction History remain readable.
- For each size, open every game and confirm primary action buttons are visible.

## Compliance Copy
- Confirm global notice says: `Prototype mode. Redemptions are not currently enabled. Gold Coins have no cash value.`
- Confirm Wallet repeats disabled redemption status.
- Confirm Purchase Coins says demo purchase only and no direct Sweeps purchase.
- Confirm legal placeholder pages say draft placeholder and counsel review required.
- Confirm no user-facing page offers real payments, withdrawals, cashout, prizes, or active redemption.

## Final Commands
- Run `npm run build`.
- Run `npm run test:dev`.
- Confirm browser console has no errors on Lobby, Wallet, Admin, and each game route.
