-- orthodontics テーブル用: anon からの参照/更新を許可する最小構成
-- 必要に応じて policy 条件は絞ってください。

alter table public.orthodontics enable row level security;

-- 既存ポリシーがあれば削除
DROP POLICY IF EXISTS orthodontics_select_all ON public.orthodontics;
DROP POLICY IF EXISTS orthodontics_insert_all ON public.orthodontics;
DROP POLICY IF EXISTS orthodontics_update_all ON public.orthodontics;

-- anon/authenticated で読み取り可
create policy orthodontics_select_all
on public.orthodontics
for select
to anon, authenticated
using (true);

-- anon/authenticated で追加可
create policy orthodontics_insert_all
on public.orthodontics
for insert
to anon, authenticated
with check (true);

-- anon/authenticated で更新可
create policy orthodontics_update_all
on public.orthodontics
for update
to anon, authenticated
using (true)
with check (true);

-- 必要権限を付与
grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.orthodontics to anon, authenticated;
