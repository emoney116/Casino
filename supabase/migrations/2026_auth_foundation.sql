-- PLAYHEATER Auth Foundation upgrade.
-- Phase 1 only: no phone auth, SMS verification, or MFA objects.
-- Safe to re-run; does not delete or reset user data.

alter table public.profiles
add column if not exists avatar_data_url text;

alter table public.profiles
add column if not exists username_normalized text;

update public.profiles
set username_normalized = lower(trim(username))
where username_normalized is null
  or username_normalized = '';

-- Existing duplicate usernames would make a unique index fail. Keep the
-- first row on the normalized value and make later duplicate rows unique.
with ranked as (
  select
    id,
    username_normalized,
    row_number() over (
      partition by username_normalized
      order by created_at nulls last, id
    ) as duplicate_rank
  from public.profiles
  where username_normalized is not null
    and username_normalized <> ''
)
update public.profiles p
set username_normalized = left(r.username_normalized, 48) || '_' || r.duplicate_rank::text || '_' || left(replace(p.id, '-', ''), 8)
from ranked r
where p.id = r.id
  and r.duplicate_rank > 1;

update public.profiles
set username_normalized = 'user_' || left(replace(id, '-', ''), 8)
where username_normalized is null
  or username_normalized = '';

create unique index if not exists profiles_username_normalized_key
on public.profiles (username_normalized);

insert into public.wallet_balances (user_id, gold, bonus)
select id, 0, 0
from public.profiles
on conflict (user_id) do nothing;

insert into public.vip_progress (user_id, lifetime_sc_wagered)
select id, 0
from public.profiles
on conflict (user_id) do nothing;

insert into public.progression (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;

insert into public.streaks (user_id)
select id
from public.profiles
on conflict (user_id) do nothing;

create or replace function public.normalize_username(candidate text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(lower(trim(candidate)), '');
$$;

create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.normalize_username(candidate) is not null
    and not exists (
      select 1
      from public.profiles
      where username_normalized = public.normalize_username(candidate)
    );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

create or replace function public.set_profile_username_normalized()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.username_normalized := coalesce(
    public.normalize_username(new.username),
    'user_' || left(replace(new.id, '-', ''), 8)
  );
  return new;
end;
$$;

drop trigger if exists set_profile_username_normalized on public.profiles;
create trigger set_profile_username_normalized
before insert or update of username on public.profiles
for each row
execute function public.set_profile_username_normalized();

create or replace function public.bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id text := new.id::text;
  v_email text := coalesce(new.email, v_user_id || '@playheater.local');
  v_requested_username text;
  v_username text;
  v_username_normalized text;
  v_fallback_base text := 'user_' || left(replace(new.id::text, '-', ''), 8);
  v_attempt integer := 0;
begin
  v_requested_username := nullif(trim(coalesce(new.raw_user_meta_data->>'username', '')), '');

  loop
    if v_attempt = 0 and public.is_username_available(v_requested_username) then
      v_username := v_requested_username;
    elsif v_attempt = 0 then
      v_username := v_fallback_base;
    else
      v_username := v_fallback_base || '_' || v_attempt::text;
    end if;

    v_username_normalized := public.normalize_username(v_username);

    begin
      insert into public.profiles (
        id,
        email,
        username,
        username_normalized,
        role,
        roles,
        account_status
      )
      values (
        v_user_id,
        v_email,
        v_username,
        v_username_normalized,
        'USER',
        array['USER'],
        'ACTIVE'
      )
      on conflict (id) do nothing;

      exit;
    exception
      when unique_violation then
        v_attempt := v_attempt + 1;
        if v_attempt > 25 then
          raise warning 'PLAYHEATER auth bootstrap could not allocate a unique username for auth user %', v_user_id;
          exit;
        end if;
    end;
  end loop;

  insert into public.wallet_balances (user_id, gold, bonus)
  values (v_user_id, 0, 0)
  on conflict (user_id) do nothing;

  insert into public.vip_progress (user_id, lifetime_sc_wagered)
  values (v_user_id, 0)
  on conflict (user_id) do nothing;

  insert into public.progression (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.streaks (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    raise warning 'PLAYHEATER auth bootstrap failed for auth user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists playheater_bootstrap_auth_user on auth.users;
create trigger playheater_bootstrap_auth_user
after insert on auth.users
for each row
execute function public.bootstrap_auth_user();

create or replace function public.record_vip_wager(
  p_transaction_id text
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id text;
  v_amount numeric;
begin
  select user_id, abs(amount)
  into v_user_id, v_amount
  from public.wallet_transactions
  where id = p_transaction_id
    and user_id = auth.uid()::text
    and currency = 'BONUS'
    and amount < 0
    and type in ('GAME_BET', 'TABLE_BET', 'ARCADE_BET', 'BUY_BONUS')
    and (status is null or status = 'COMPLETED');

  if v_user_id is null or v_amount is null or v_amount <= 0 then
    return;
  end if;

  insert into public.vip_progress (user_id, lifetime_sc_wagered, updated_at)
  values (v_user_id, 0, now())
  on conflict (user_id) do nothing;

  insert into public.vip_wager_transactions (transaction_id, user_id, amount)
  values (p_transaction_id, v_user_id, v_amount)
  on conflict (transaction_id) do nothing;

  if found then
    update public.vip_progress
    set lifetime_sc_wagered = lifetime_sc_wagered + v_amount,
        updated_at = now()
    where user_id = v_user_id;
  end if;
end;
$$;
