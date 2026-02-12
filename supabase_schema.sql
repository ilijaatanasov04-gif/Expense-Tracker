create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expense_date date not null,
  category text not null check (category in ('Food', 'Transport', 'Other')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

create policy if not exists "select own expenses"
on public.expenses
for select
using (auth.uid() = user_id);

create policy if not exists "insert own expenses"
on public.expenses
for insert
with check (auth.uid() = user_id);

create policy if not exists "update own expenses"
on public.expenses
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "delete own expenses"
on public.expenses
for delete
using (auth.uid() = user_id);
