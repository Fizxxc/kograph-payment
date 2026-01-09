create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  role text default 'user',
  is_withdraw_blocked boolean default false,
  created_at timestamptz default now()
);

-- Ensure columns exist (idempotent update)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'is_withdraw_blocked') then
    alter table public.profiles add column is_withdraw_blocked boolean default false;
  end if;
end $$;

alter table public.profiles enable row level security;

create table if not exists public.kograph_user_settings (
  user_id uuid references auth.users(id) on delete cascade not null primary key,
  default_amount numeric default 10000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.kograph_user_settings enable row level security;

create table if not exists public.kograph_api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  revoked_at timestamptz,
  created_at timestamptz default now()
);
alter table public.kograph_api_keys enable row level security;
create index if not exists kograph_api_keys_user_id_idx on public.kograph_api_keys(user_id);

create table if not exists public.kograph_checkouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  api_key_id uuid references public.kograph_api_keys(id) on delete set null,
  kind text default 'api',
  amount numeric not null,
  currency text default 'IDR',
  description text,
  status text default 'pending',
  saweria_event_id text unique,
  created_at timestamptz default now(),
  paid_at timestamptz
);
alter table public.kograph_checkouts enable row level security;
create index if not exists kograph_checkouts_user_id_idx on public.kograph_checkouts(user_id);
create index if not exists kograph_checkouts_status_idx on public.kograph_checkouts(status);

create table if not exists public.kograph_balance_ledger (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  checkout_id uuid references public.kograph_checkouts(id) on delete set null,
  entry_type text not null,
  amount numeric not null,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.kograph_balance_ledger enable row level security;
create index if not exists kograph_balance_ledger_user_id_idx on public.kograph_balance_ledger(user_id);

create table if not exists public.kograph_withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric not null,
  status text default 'requested',
  note text,
  channel_category text,
  channel_code text,
  account_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  paid_at timestamptz
);

-- Ensure withdrawal columns exist
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'kograph_withdrawals' and column_name = 'channel_category') then
    alter table public.kograph_withdrawals add column channel_category text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'kograph_withdrawals' and column_name = 'channel_code') then
    alter table public.kograph_withdrawals add column channel_code text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'kograph_withdrawals' and column_name = 'account_number') then
    alter table public.kograph_withdrawals add column account_number text;
  end if;
end $$;

alter table public.kograph_withdrawals enable row level security;
create index if not exists kograph_withdrawals_user_id_idx on public.kograph_withdrawals(user_id);
create index if not exists kograph_withdrawals_status_idx on public.kograph_withdrawals(status);

create table if not exists public.kograph_audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  ip text,
  user_agent text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.kograph_audit_logs enable row level security;
create index if not exists kograph_audit_logs_created_at_idx on public.kograph_audit_logs(created_at desc);

create table if not exists public.kograph_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.kograph_notifications enable row level security;

-- POLICIES

-- Drop all existing policies to avoid conflicts
drop policy if exists "Profiles readable by owner and admin" on public.profiles;
drop policy if exists "Profiles insertable by owner" on public.profiles;
drop policy if exists "Profiles updatable by owner" on public.profiles;
drop policy if exists "Profiles update by admin" on public.profiles;

drop policy if exists "Kograph settings readable by owner and admin" on public.kograph_user_settings;
drop policy if exists "Kograph settings insert by owner" on public.kograph_user_settings;
drop policy if exists "Kograph settings update by owner" on public.kograph_user_settings;

drop policy if exists "Kograph api keys readable by owner and admin" on public.kograph_api_keys;
drop policy if exists "Kograph api keys insert by owner" on public.kograph_api_keys;
drop policy if exists "Kograph api keys update by owner" on public.kograph_api_keys;

drop policy if exists "Kograph checkouts readable by owner and admin" on public.kograph_checkouts;
drop policy if exists "Kograph checkouts insert by owner" on public.kograph_checkouts;

drop policy if exists "Kograph ledger readable by owner and admin" on public.kograph_balance_ledger;
drop policy if exists "Kograph ledger insert by service role" on public.kograph_balance_ledger;

drop policy if exists "Kograph withdrawals readable by owner and admin" on public.kograph_withdrawals;
drop policy if exists "Kograph withdrawals insert by owner" on public.kograph_withdrawals;
drop policy if exists "Kograph withdrawals update by admin" on public.kograph_withdrawals;

drop policy if exists "Kograph audit readable by admin and service role" on public.kograph_audit_logs;
drop policy if exists "Kograph audit insert by service role" on public.kograph_audit_logs;

drop policy if exists "Notifications readable by owner" on public.kograph_notifications;
drop policy if exists "Notifications update by owner" on public.kograph_notifications;
drop policy if exists "Notifications insert by admin/service" on public.kograph_notifications;

-- Re-create policies after dropping them

create policy "Profiles readable by owner and admin" on public.profiles
  for select using (
    auth.uid() = id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Profiles insertable by owner" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Profiles updatable by owner" on public.profiles
  for update using (auth.uid() = id);

create policy "Profiles update by admin" on public.profiles
  for update using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

create policy "Kograph settings readable by owner and admin" on public.kograph_user_settings
  for select using (
    auth.uid() = user_id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph settings insert by owner" on public.kograph_user_settings
  for insert with check (auth.uid() = user_id);

create policy "Kograph settings update by owner" on public.kograph_user_settings
  for update using (auth.uid() = user_id);

create policy "Kograph api keys readable by owner and admin" on public.kograph_api_keys
  for select using (
    auth.uid() = user_id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph api keys insert by owner" on public.kograph_api_keys
  for insert with check (auth.uid() = user_id);

create policy "Kograph api keys update by owner" on public.kograph_api_keys
  for update using (auth.uid() = user_id);

create policy "Kograph checkouts readable by owner and admin" on public.kograph_checkouts
  for select using (
    auth.uid() = user_id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph checkouts insert by owner" on public.kograph_checkouts
  for insert with check (auth.uid() = user_id);

create policy "Kograph ledger readable by owner and admin" on public.kograph_balance_ledger
  for select using (
    auth.uid() = user_id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph ledger insert by service role" on public.kograph_balance_ledger
  for insert with check (auth.role() = 'service_role');

create policy "Kograph withdrawals readable by owner and admin" on public.kograph_withdrawals
  for select using (
    auth.uid() = user_id
    or (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph withdrawals insert by owner" on public.kograph_withdrawals
  for insert with check (auth.uid() = user_id);

create policy "Kograph withdrawals update by admin" on public.kograph_withdrawals
  for update using ((select role from profiles where id = auth.uid()) = 'admin');

create policy "Kograph audit readable by admin and service role" on public.kograph_audit_logs
  for select using (
    (select role from profiles where id = auth.uid()) = 'admin'
    or auth.role() = 'service_role'
  );

create policy "Kograph audit insert by service role" on public.kograph_audit_logs
  for insert with check (auth.role() = 'service_role');

create policy "Notifications readable by owner" on public.kograph_notifications
  for select using (auth.uid() = user_id);

create policy "Notifications update by owner" on public.kograph_notifications
  for update using (auth.uid() = user_id);
  
create policy "Notifications insert by admin/service" on public.kograph_notifications
  for insert with check (
    auth.role() = 'service_role' or 
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- FUNCTIONS & TRIGGERS

create or replace function public.kograph_set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists kograph_settings_set_updated_at on public.kograph_user_settings;
create trigger kograph_settings_set_updated_at
before update on public.kograph_user_settings
for each row execute procedure public.kograph_set_updated_at();

drop trigger if exists kograph_withdrawals_set_updated_at on public.kograph_withdrawals;
create trigger kograph_withdrawals_set_updated_at
before update on public.kograph_withdrawals
for each row execute procedure public.kograph_set_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, is_withdraw_blocked)
  values (new.id, new.email, 'user', false)
  on conflict (id) do nothing;
  insert into public.kograph_user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
