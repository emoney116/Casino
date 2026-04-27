-- Casino Prototype optional Supabase backend schema.
-- This remains virtual-currency only: no real payments, withdrawals, prizes,
-- sweepstakes redemption, cashout, or real-money gambling flows.

create table if not exists public.profiles (
  id text primary key,
  email text not null unique,
  username text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  role text not null default 'USER',
  roles text[] not null default array['USER'],
  account_status text not null default 'ACTIVE'
);

create table if not exists public.wallet_balances (
  user_id text primary key references public.profiles(id) on delete cascade,
  gold numeric not null default 0 check (gold >= 0),
  bonus numeric not null default 0 check (bonus >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  type text not null,
  currency text not null check (currency in ('GOLD', 'BONUS')),
  amount numeric not null,
  balance_after numeric not null check (balance_after >= 0),
  status text not null default 'COMPLETED',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.progression (
  user_id text primary key references public.profiles(id) on delete cascade,
  level integer not null default 1,
  xp integer not null default 0,
  lifetime_spins integer not null default 0,
  lifetime_wins integer not null default 0,
  lifetime_wagered numeric not null default 0,
  lifetime_won numeric not null default 0,
  biggest_win numeric not null default 0,
  current_streak_days integer not null default 0,
  last_active_at timestamptz
);

create table if not exists public.streaks (
  user_id text primary key references public.profiles(id) on delete cascade,
  day integer not null default 1,
  current_streak_days integer not null default 0,
  last_claimed_at timestamptz
);

create table if not exists public.missions (
  user_id text not null references public.profiles(id) on delete cascade,
  mission_id text not null,
  progress numeric not null default 0,
  status text not null default 'ACTIVE',
  last_reset_at timestamptz not null default now(),
  played_games text[] not null default '{}',
  primary key (user_id, mission_id)
);

create table if not exists public.favorites (
  user_id text not null references public.profiles(id) on delete cascade,
  game_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.recently_played (
  user_id text not null references public.profiles(id) on delete cascade,
  game_id text not null,
  played_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.profiles enable row level security;
alter table public.wallet_balances enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.progression enable row level security;
alter table public.streaks enable row level security;
alter table public.missions enable row level security;
alter table public.favorites enable row level security;
alter table public.recently_played enable row level security;

-- RLS assumes a future Supabase Auth migration where profiles.id equals auth.uid()::text.
-- Until then, the app keeps localStorage as source of truth and Supabase writes may be blocked.
create policy "profiles_select_own" on public.profiles for select using (auth.uid()::text = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid()::text = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid()::text = id) with check (auth.uid()::text = id);

create policy "wallet_balances_select_own" on public.wallet_balances for select using (auth.uid()::text = user_id);
create policy "wallet_balances_insert_own" on public.wallet_balances for insert with check (auth.uid()::text = user_id);
create policy "wallet_balances_update_own" on public.wallet_balances for update using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

create policy "wallet_transactions_select_own" on public.wallet_transactions for select using (auth.uid()::text = user_id);
create policy "wallet_transactions_insert_own" on public.wallet_transactions for insert with check (auth.uid()::text = user_id);

create policy "progression_all_own" on public.progression for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "streaks_all_own" on public.streaks for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "missions_all_own" on public.missions for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "favorites_all_own" on public.favorites for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
create policy "recently_played_all_own" on public.recently_played for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Admin TODO:
-- Admin/dev tooling should use server-side routes or Edge Functions with service-role
-- credentials. Never expose service-role keys in this Vite client app.
