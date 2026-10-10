-- ダーツ相談チャットの会話を保存する表
-- Supabase の SQL Editor で1回だけ実行してください。
-- 会話はログインした本人だけが読み書きできます（未ログインの公開キーからは見えません）。

create table if not exists public.darts_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 会話で使うモデル（会話の途中では変えない）
  model text not null,
  -- 一覧に出す見出し（最初の質問の冒頭）
  title text not null default '',
  -- Claude に送る会話の履歴（Claude の返答をそのまま足していく）
  history jsonb not null default '[]'::jsonb,
  -- 画面に表示する会話（質問・答え・使ったトークン数）
  display jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists darts_chat_conversations_user_updated_idx
  on public.darts_chat_conversations (user_id, updated_at desc);

alter table public.darts_chat_conversations enable row level security;

-- anon（未ログイン）には何も許可しない
revoke all on table public.darts_chat_conversations from anon;
grant select, insert, update, delete on table public.darts_chat_conversations to authenticated;

drop policy if exists darts_chat_conversations_owner on public.darts_chat_conversations;

create policy darts_chat_conversations_owner
  on public.darts_chat_conversations
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
