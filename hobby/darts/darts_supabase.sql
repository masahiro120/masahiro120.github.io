-- ダーツ練習記録（カウントアップ）
-- Supabase の SQL Editor で実行してください。
-- 公開ページから使うため anon には「読み取り」と「保存（追加）」だけを許可し、更新・削除はダッシュボードから行います。

create table if not exists public.darts_games (
  id bigint generated always as identity primary key,
  played_at timestamptz not null default now(),
  game_type text not null default 'countup',
  total_score integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.darts_throws (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.darts_games(id) on delete cascade,
  round smallint not null check (round between 1 and 8),
  dart smallint not null check (dart between 1 and 3),
  -- ブル中心を原点とした mm 単位の座標（x: 右が正, y: 上が正）。座標なしのボード外は null
  x real,
  y real,
  -- 刺さった区画のナンバー。ブルと座標なしのボード外は null
  number smallint check (number between 1 and 20),
  ring text not null check (ring in ('IB', 'OB', 'IS', 'T', 'OS', 'D', 'OUT')),
  score smallint not null check (score between 0 and 60),
  created_at timestamptz not null default now(),
  unique (game_id, round, dart)
);

create index if not exists darts_throws_game_id_idx on public.darts_throws (game_id);

alter table public.darts_games enable row level security;
alter table public.darts_throws enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on table public.darts_games to anon, authenticated;
grant select, insert on table public.darts_throws to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

drop policy if exists darts_games_select_all on public.darts_games;
drop policy if exists darts_games_insert_all on public.darts_games;
drop policy if exists darts_throws_select_all on public.darts_throws;
drop policy if exists darts_throws_insert_all on public.darts_throws;

create policy darts_games_select_all
  on public.darts_games
  for select
  to anon, authenticated
  using (true);

create policy darts_games_insert_all
  on public.darts_games
  for insert
  to anon, authenticated
  with check (true);

create policy darts_throws_select_all
  on public.darts_throws
  for select
  to anon, authenticated
  using (true);

create policy darts_throws_insert_all
  on public.darts_throws
  for insert
  to anon, authenticated
  with check (true);

-- 1ゲーム分（ゲーム＋24投）を1トランザクションで保存する。合計点は投げの点数から計算する
create or replace function public.save_darts_game(p_note text, p_throws jsonb)
returns bigint
language plpgsql
as $$
declare
  v_game_id bigint;
begin
  insert into public.darts_games (note, total_score)
  values (
    coalesce(p_note, ''),
    (select coalesce(sum((t ->> 'score')::integer), 0) from jsonb_array_elements(p_throws) as t)
  )
  returning id into v_game_id;

  insert into public.darts_throws (game_id, round, dart, x, y, number, ring, score)
  select
    v_game_id,
    (t ->> 'round')::smallint,
    (t ->> 'dart')::smallint,
    (t ->> 'x')::real,
    (t ->> 'y')::real,
    (t ->> 'number')::smallint,
    t ->> 'ring',
    (t ->> 'score')::smallint
  from jsonb_array_elements(p_throws) as t;

  return v_game_id;
end;
$$;

grant execute on function public.save_darts_game(text, jsonb) to anon, authenticated;
