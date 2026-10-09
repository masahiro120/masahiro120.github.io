-- ダーツ練習記録：ゲームごとの「狙い」（BULL / T1〜T20）を追加する
-- 既存の darts_games / darts_throws がある Supabase の SQL Editor で1回だけ実行してください。
-- 既存のゲームはすべて target = 'BULL' になります。

alter table public.darts_games
  add column if not exists target text not null default 'BULL';

alter table public.darts_games
  drop constraint if exists darts_games_target_check;

alter table public.darts_games
  add constraint darts_games_target_check check (target ~ '^(BULL|T([1-9]|1[0-9]|20))$');

-- 引数が増えるため、古い2引数版を消してから作り直す（同名の関数が2つあると呼び出しが曖昧になる）
drop function if exists public.save_darts_game(text, jsonb);

create or replace function public.save_darts_game(p_note text, p_throws jsonb, p_target text default 'BULL')
returns bigint
language plpgsql
as $$
declare
  v_game_id bigint;
begin
  insert into public.darts_games (note, target, total_score)
  values (
    coalesce(p_note, ''),
    coalesce(p_target, 'BULL'),
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

grant execute on function public.save_darts_game(text, jsonb, text) to anon, authenticated;
