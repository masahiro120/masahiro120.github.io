create table if not exists public.savings_pending_items (
  id bigint generated always as identity primary key,
  item_name text not null,
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12,0) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.savings_pending_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.savings_pending_items to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists savings_pending_items_select_all on public.savings_pending_items;
drop policy if exists savings_pending_items_insert_all on public.savings_pending_items;
drop policy if exists savings_pending_items_update_all on public.savings_pending_items;
drop policy if exists savings_pending_items_delete_all on public.savings_pending_items;

create policy savings_pending_items_select_all
  on public.savings_pending_items
  for select
  to anon, authenticated
  using (true);

create policy savings_pending_items_insert_all
  on public.savings_pending_items
  for insert
  to anon, authenticated
  with check (true);

create policy savings_pending_items_update_all
  on public.savings_pending_items
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy savings_pending_items_delete_all
  on public.savings_pending_items
  for delete
  to anon, authenticated
  using (true);
