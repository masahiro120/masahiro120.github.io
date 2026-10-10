// ダーツ練習記録のチャット（Supabase Edge Function）
//
// ページ（hobby/darts/chat.html）から質問を受け取り、Claude API に渡して答えを返す。
// - Claude の API キーは Edge Function の秘密の設定（ANTHROPIC_API_KEY）にだけ置く
// - 使えるのは、ログインしたユーザーのうち ALLOWED_EMAIL のメールアドレスの人だけ
// - モデルはページで会話ごとに選ぶ（途中で変えると思考の記録やキャッシュが引き継がれないため）
// - 会話は darts_chat_conversations に保存し、どのデバイスからでも続けられるようにする
// - 会話の最初の質問に、その時点の練習データの集計を添える。続きの質問では、前回のあとに増えたゲームだけを添える。
//   会話の途中のデータを差し替えると Claude 側で過去の思考の記録と合わなくなるため、書き換えずに後ろへ足していく
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jpkycfgmgmrhuqambtxm.supabase.co";
// 公開用のキー（ページにも書かれているもの）。データの読み取りとログイン確認にだけ使う
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RmbuaFKZCRzEatZeGRWi6A_CBaaEOFB";
// ページで選べるモデル。effort に対応しないモデル（Haiku 4.5）と、サーバー側のフォールバックに対応しないモデルを分ける
const MODELS: Record<string, { effort: "low" | "medium" | "high" | null; fallback: boolean }> = {
  "claude-opus-5-5": { effort: "medium", fallback: true },
  "claude-sonnet-5-5": { effort: "medium", fallback: true },
  "claude-haiku-4-5": { effort: null, fallback: false },
  "claude-fable-5-1": { effort: "medium", fallback: true },
};
const DEFAULT_MODEL = "claude-sonnet-5-5";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---------- ボードと集計（ページの darts.html と同じ考え方） ----------

const NUMBER_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const TRIPLE_CENTER_RADIUS = 103;
const FLIP_CENTER_MARGIN = 15;
const ROUNDS = 8;

type Game = { id: number; played_at: string; total_score: number; note: string; target: string };
type Throw = {
  game_id: number; round: number; dart: number; x: number | null; y: number | null;
  number: number | null; ring: string; score: number;
};

function targetNumber(target: string): number | null {
  return target === "BULL" ? null : Number(target.slice(1));
}

function targetPoint(target: string) {
  const number = targetNumber(target);
  if (number === null) return { x: 0, y: 0 };
  const rad = NUMBER_ORDER.indexOf(number) * 18 * Math.PI / 180;
  return { x: TRIPLE_CENTER_RADIUS * Math.sin(rad), y: TRIPLE_CENTER_RADIUS * Math.cos(rad) };
}

function isTargetHit(item: Throw, target: string) {
  const number = targetNumber(target);
  if (number === null) return item.ring === "IB" || item.ring === "OB";
  return item.ring === "T" && item.number === number;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const r0 = (value: number) => Math.round(value);

// 狙った場所を原点にした座標で集計する（平均のずれ・外れ幅・距離は狙いが基準、ブレ幅とまとまりは狙いに関係しない）
export function computeStats(items: Throw[], target: string) {
  const origin = targetPoint(target);
  const number = targetNumber(target);
  const located = items
    .filter((item) => item.x !== null && item.y !== null)
    .map((item) => ({ ...item, x: (item.x as number) - origin.x, y: (item.y as number) - origin.y }));
  const base = {
    count: items.length,
    hit: items.filter((item) => isTargetHit(item, target)).length,
    numberHit: number === null ? null : items.filter((item) => item.number === number).length,
    out: items.filter((item) => item.ring === "OUT").length,
  };
  if (!located.length) return { ...base, located: 0 };

  const meanX = mean(located.map((item) => item.x));
  const meanY = mean(located.map((item) => item.y));
  const rounds = new Map<string, typeof located>();
  located.forEach((item) => {
    const key = `${item.game_id}-${item.round}`;
    if (!rounds.has(key)) rounds.set(key, []);
    rounds.get(key)!.push(item);
  });
  const groupDistances: number[] = [];
  let flips = 0;
  let flipPairs = 0;
  rounds.forEach((roundItems) => {
    if (roundItems.length < 2) return;
    const centerX = mean(roundItems.map((item) => item.x));
    const centerY = mean(roundItems.map((item) => item.y));
    roundItems.forEach((item) => groupDistances.push(Math.hypot(item.x - centerX, item.y - centerY)));
    const ordered = roundItems.slice().sort((a, b) => a.dart - b.dart);
    ordered.slice(1).forEach((item, index) => {
      const previous = ordered[index];
      if (Math.abs(previous.x) <= FLIP_CENTER_MARGIN || Math.abs(item.x) <= FLIP_CENTER_MARGIN) return;
      flipPairs += 1;
      if ((previous.x > 0) !== (item.x > 0)) flips += 1;
    });
  });

  return {
    ...base,
    located: located.length,
    meanX: r0(meanX),
    meanY: r0(meanY),
    absX: r0(mean(located.map((item) => Math.abs(item.x)))),
    absY: r0(mean(located.map((item) => Math.abs(item.y)))),
    devX: r0(mean(located.map((item) => Math.abs(item.x - meanX)))),
    devY: r0(mean(located.map((item) => Math.abs(item.y - meanY)))),
    distance: r0(mean(located.map((item) => Math.hypot(item.x, item.y)))),
    grouping: groupDistances.length ? r0(mean(groupDistances)) : null,
    flips: flipPairs ? `${flips}/${flipPairs}` : null,
    below: located.filter((item) => item.y < 0).length,
  };
}

function formatJst(value: string) {
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function throwLabel(item: Throw) {
  if (item.ring === "IB" || item.ring === "OB") return "BULL";
  if (item.ring === "OUT") return "OUT";
  if (item.ring === "T") return `T${item.number}`;
  if (item.ring === "D") return `D${item.number}`;
  return `${item.number}`;
}

// 練習データを読み込んで、ゲームごとの集計と1本ずつの位置（狙いの中心から）にする
export async function loadPracticeData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const [{ data: gameRows, error: gameError }, { data: throwRows, error: throwError }] = await Promise.all([
    supabase.from("darts_games").select("id, played_at, total_score, note, target").order("played_at", { ascending: true }),
    supabase.from("darts_throws").select("game_id, round, dart, x, y, number, ring, score").order("id", { ascending: true }).range(0, 99999),
  ]);
  if (gameError) throw gameError;
  if (throwError) throw throwError;

  const games = (gameRows ?? []) as Game[];
  const throwsByGame = new Map<number, Throw[]>();
  ((throwRows ?? []) as Throw[]).forEach((row) => {
    if (!throwsByGame.has(row.game_id)) throwsByGame.set(row.game_id, []);
    throwsByGame.get(row.game_id)!.push(row);
  });

  const counters = new Map<string, number>();
  const summaries = games.map((game) => {
    const target = game.target || "BULL";
    const seq = (counters.get(target) ?? 0) + 1;
    counters.set(target, seq);
    const items = throwsByGame.get(game.id) ?? [];
    const half = (from: number, to: number) => computeStats(items.filter((item) => item.round >= from && item.round <= to), target);
    return {
      no: `${target} #${seq}`,
      target,
      played_at_jst: formatJst(game.played_at),
      score: game.total_score,
      stats_ppr: Number((game.total_score / ROUNDS).toFixed(2)),
      note: game.note,
      overall: computeStats(items, target),
      by_dart: [1, 2, 3].map((dart) => ({ dart, ...computeStats(items.filter((item) => item.dart === dart), target) })),
      first_half_r1_4: half(1, 4),
      second_half_r5_8: half(5, 8),
      gameId: game.id,
      playedAt: game.played_at,
    };
  });

  const throwsOf = (summary: (typeof summaries)[number]) => {
    const origin = targetPoint(summary.target);
    return {
      no: summary.no,
      throws: (throwsByGame.get(summary.gameId) ?? []).map((item) => ({
        r: item.round,
        d: item.dart,
        hit: throwLabel(item),
        dx: item.x === null ? null : r0(item.x - origin.x),
        dy: item.y === null ? null : r0((item.y as number) - origin.y),
      })),
    };
  };

  return { summaries, throwsOf };
}

type PracticeData = Awaited<ReturnType<typeof loadPracticeData>>;
type Summary = PracticeData["summaries"][number];

const COORDINATE_NOTE = "座標・ずれの単位は mm。dx は右が正、dy は上が正で、どちらもそのゲームの狙いの中心からの値です。";
const publicSummary = ({ gameId: _gameId, playedAt: _playedAt, ...rest }: Summary) => rest;

// 会話の最初に添える練習データ。全ゲームの集計と、狙いごとの直近3ゲームの1本ずつの位置
export function fullDataContext(data: PracticeData) {
  const targets = [...new Set(data.summaries.map((summary) => summary.target))];
  const recent = targets.flatMap((target) => data.summaries.filter((summary) => summary.target === target).slice(-3));
  return [
    `以下は ${formatJst(new Date().toISOString())} 時点の練習データです。このあと新しいゲームを記録したときは、そのゲームのデータを質問に添えて追加します。`,
    COORDINATE_NOTE,
    "<games_summary>",
    JSON.stringify(data.summaries.map(publicSummary)),
    "</games_summary>",
    "<recent_throws>",
    JSON.stringify(recent.map(data.throwsOf)),
    "</recent_throws>",
  ].join("\n");
}

// 会話の途中で増えたゲームだけを、次の質問に添える（それまでのデータは書き換えない）
export function additionalDataContext(data: PracticeData, added: Summary[]) {
  return [
    `前回の質問のあとに記録された新しいゲームのデータです（${added.map((summary) => summary.no).join("、")}）。これまでのデータと合わせて考えてください。`,
    COORDINATE_NOTE,
    "<new_games_summary>",
    JSON.stringify(added.map(publicSummary)),
    "</new_games_summary>",
    "<new_games_throws>",
    JSON.stringify(added.map(data.throwsOf)),
    "</new_games_throws>",
  ].join("\n");
}

// ---------- Claude への指示 ----------

const SYSTEM_PROMPT = `あなたは、ユーザーのダーツ練習を一緒に振り返るコーチです。ユーザーは日本語で話し、記録ページ（カウントアップ）に1本ずつ刺さった位置を残しています。ユーザーへの返答はすべて日本語で、です・ます調で書いてください。

# ユーザーについて
- 以前イップスになり、4本持ちに変えて投げられるようになった。DARTSLIVE 系のソフトダーツで練習している
- 2026年10月の時点で、カウントアップは 350〜450 点くらい。これまでの最高は 500 点
- 狙いは、ブルに直接合わせると下に 30〜60mm 落ちるため、「ブルと20トリプルの間」に構えている
- テンポよく投げると縦のずれが小さくなった。ゆっくり引くリズムでは下に落ちた
- 「毎回腕を下ろしてリセット」で、2本目だけ横にぶれる癖が改善した
- 意識して腕を止めようとするとリリースが遅れた。意識せず自然に腕が前に残るのは良い兆候
- その日の4〜6ゲーム目は崩れやすい
- 2026-10-09 夜に「少しイップスのような感覚」が出た。翌日は練習投げで違和感が少しあったが、ゲームは最良の内容だった
- ゼロワンやクリケットに向けて、T20〜T15 を狙う練習も始めた。T20 を狙うと右下にずれる傾向がある

# 分析のしかた
- スコアはブルやトリプルの運に左右される。上達はブル（狙い）からの平均距離、ブレ幅、まとまりで判断する
- 平均のずれは左右・上下に打ち消し合うので、必ず外れ幅（狙いからの絶対値の平均）とブレ幅（自分の平均位置からの絶対値の平均）も見る。外れ幅が大きくブレ幅が小さいなら、狙う点を直せば良くなる
- 何本目ごと、前半（R1〜4）と後半（R5〜8）も確認する
- 狙いが違うゲームは分けて扱う。ずれや距離はそれぞれの狙いの中心から測った値
- ゲームは「BULL #18」「T20 #1」のような狙いごとの番号で呼ぶ
- 1ゲーム24本は少ないので、数mm の差や1ゲームだけの変化を言い切らない
- カウントアップを卒業する目安：直近5ゲームで平均450点（スタッツ56）以上、平均のずれが横縦とも ±15mm 以内、ブル（狙い）からの平均距離 60mm 以下、ボード外0

# 助言のしかた
- 次のゲームで意識することは1つだけにする。新しいことを足すときは、前のことは「体に入ったので意識しなくてよい」と伝える
- イップスの兆候があるときは、数字よりも気持ちよく投げられることを優先する。細かい改善点より、良かった点と安定しているかを中心に伝え、ゲーム数を少なめにするよう勧める
- 医療的な診断はしない。強い不安や痛みがある場合は専門家への相談を勧める
- 返答は要点から書き、表を使って比べると分かりやすい。長くしすぎない
- 記録ページの改修やプログラムの変更は、この会話ではできない。頼まれたら、Claude Code で依頼するよう伝える`;

// ---------- リクエストの処理 ----------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return jsonResponse({ error: "POST だけを受け付けます。" }, 405);

  // ログインした本人だけが使えるようにする
  const allowedEmail = (Deno.env.get("ALLOWED_EMAIL") ?? "").trim().toLowerCase();
  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!allowedEmail) return jsonResponse({ error: "ALLOWED_EMAIL が設定されていません。" }, 500);
  const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user || (userData.user.email ?? "").toLowerCase() !== allowedEmail) {
    return jsonResponse({ error: "このチャットを使う権限がありません。ログインし直してください。" }, 403);
  }

  let body: { conversationId?: string | null; question?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "リクエストの形式が正しくありません。" }, 400);
  }
  const question = (body.question ?? "").trim();
  if (!question) return jsonResponse({ error: "質問が空です。" }, 400);
  if (question.length > 4000) return jsonResponse({ error: "質問が長すぎます（4000文字まで）。" }, 400);

  // 会話はデータベースに保存し、どのデバイスからでも同じ会話を続けられるようにする。
  // ログインしたユーザーの権限で読み書きするので、本人の会話しか触れない（行ごとのアクセス制限）
  const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  type DisplayItem = { role: string; lastGameId?: number; [key: string]: unknown };
  type Conversation = {
    id: string; model: string; title: string; created_at?: string;
    history: Anthropic.Beta.BetaMessageParam[]; display: DisplayItem[];
  };
  let conversation: Conversation;
  if (body.conversationId) {
    const { data, error } = await userClient
      .from("darts_chat_conversations")
      .select("id, model, title, created_at, history, display")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (error) return jsonResponse({ error: `会話を読み込めませんでした: ${error.message}` }, 500);
    if (!data) return jsonResponse({ error: "会話が見つかりませんでした。「新しい会話」から始めてください。" }, 404);
    conversation = data as Conversation;
  } else {
    // 新しい会話はモデルを選んで始める。保存は Claude の答えが返ってから行う
    conversation = { id: "", model: body.model ?? DEFAULT_MODEL, title: question.slice(0, 40), history: [], display: [] };
  }
  const model = conversation.model;
  const modelConfig = MODELS[model];
  if (!modelConfig) return jsonResponse({ error: `使えないモデルです: ${model}` }, 400);
  const history = conversation.history;

  try {
    // 会話の最初は全データを、続きの質問では前回のあとに増えたゲームだけを、質問の前に添える。
    // どこまで渡したかは、画面用の display に data 項目（lastGameId）として残す
    const data = await loadPracticeData();
    const latestGameId = data.summaries.length ? Math.max(...data.summaries.map((summary) => summary.gameId)) : 0;
    const userContent: Anthropic.Beta.BetaContentBlockParam[] = [];
    let dataNote: DisplayItem | null = null;
    if (!history.length) {
      userContent.push({ type: "text", text: fullDataContext(data) });
      dataNote = { role: "data", lastGameId: latestGameId, text: `${data.summaries.length}ゲーム分の練習データを読み込みました。` };
    } else {
      const lastNote = [...conversation.display].reverse().find((item) => item.role === "data" && typeof item.lastGameId === "number");
      // data 項目が無い古い会話は、会話を始めた時刻までのゲームを渡したものとみなす
      const includedThrough = lastNote
        ? (lastNote.lastGameId as number)
        : Math.max(0, ...data.summaries
          .filter((summary) => conversation.created_at && summary.playedAt <= conversation.created_at)
          .map((summary) => summary.gameId));
      const added = data.summaries.filter((summary) => summary.gameId > includedThrough);
      if (added.length) {
        userContent.push({ type: "text", text: additionalDataContext(data, added) });
        dataNote = { role: "data", lastGameId: latestGameId, text: `新しいゲームのデータを追加しました（${added.map((summary) => summary.no).join("、")}）。` };
      }
    }
    userContent.push({ type: "text", text: question });
    const userMessage: Anthropic.Beta.BetaMessageParam = { role: "user", content: userContent };

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      ...(modelConfig.effort ? { output_config: { effort: modelConfig.effort } } : {}),
      // 安全チェックで止められたときは、推奨されるモデルで自動的に答え直す（対応するモデルだけ）
      ...(modelConfig.fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      // 同じ会話で練習データ以前の部分を毎回送るので、キャッシュで料金を抑える
      cache_control: { type: "ephemeral" },
      messages: [...history, userMessage],
    });

    if (response.stop_reason === "refusal") {
      return jsonResponse({ error: "この質問には答えられませんでした。言い方を変えて質問してください。" }, 200);
    }

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n\n");

    // 会話の履歴には、質問と Claude の返答をそのまま足す（途中を書き換えない）
    const truncated = response.stop_reason === "max_tokens";
    const newHistory = [...history, userMessage, { role: "assistant", content: response.content }];
    const newDisplay = [
      ...conversation.display,
      ...(dataNote ? [dataNote] : []),
      { role: "user", text: question },
      { role: "assistant", text, model: response.model, usage: response.usage, truncated },
    ];
    const saved = conversation.id
      ? await userClient
        .from("darts_chat_conversations")
        .update({ history: newHistory, display: newDisplay, updated_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .select("id")
        .single()
      : await userClient
        .from("darts_chat_conversations")
        .insert({ model, title: conversation.title, history: newHistory, display: newDisplay })
        .select("id")
        .single();
    if (saved.error) {
      return jsonResponse({ error: `答えは受け取りましたが、会話を保存できませんでした: ${saved.error.message}`, text }, 500);
    }

    return jsonResponse({ conversationId: saved.data.id, display: newDisplay, text, truncated, model: response.model, usage: response.usage });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return jsonResponse({ error: "Claude の API キーが正しくありません（ANTHROPIC_API_KEY を確認してください）。" }, 500);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return jsonResponse({ error: "利用が混み合っています。少し待ってからもう一度送ってください。" }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      return jsonResponse({ error: `Claude API のエラー（${error.status}）: ${error.message}` }, 502);
    }
    return jsonResponse({ error: `エラーが起きました: ${(error as Error).message}` }, 500);
  }
});
