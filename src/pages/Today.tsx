import { useEffect, useMemo } from "react";
import { useAllBooks } from "../data/useBooks";
import type { BookId } from "../data/types";
import { go } from "../lib/router";
import { progressOf, stageOf } from "../store/garden";
import { buildPlan, startSession, todayProgress } from "../store/session";
import { reconcileStreak } from "../store/stats";
import { useSave } from "../store/store";
import { Ring } from "../ui/Ring";
import { Sprout } from "../ui/Sprout";

const BOOK_LABEL: Record<BookId, string> = {
  "3A": "三年级上册", "3B": "三年级下册",
  "4A": "四年级上册", "4B": "四年级下册",
  "5A": "五年级上册", "5B": "五年级下册",
  "6A": "六年级上册", "6B": "六年级下册",
};

/**
 * 首页的五种状态：
 * - loading：教材还没拉完
 * - failed：教材 chunk 加载失败（books 为空数组）
 * - done：今天的目标已完成且今天没有可再学的词
 * - all-learned：八册的词全部种下
 * - ready：还有内容可学
 */
export type HomeState = "loading" | "failed" | "done" | "all-learned" | "ready";

export function homeState(
  bookCount: number | null,
  planTotal: number | null,
  done: number,
  goal: number,
  live = false,
): HomeState {
  if (bookCount === null) return "loading";
  if (bookCount === 0) return "failed";
  // 会话没结算完就还有活要干：中途达到目标（比如 Again 追加了重做步）时
  // plan.total 会是 0，不能因此把"继续学习"禁掉
  if (live) return "ready";
  if (planTotal === 0) return done >= goal ? "done" : "all-learned";
  return "ready";
}

export function Today() {
  const save = useSave((s) => s);
  const books = useAllBooks();
  const { done, goal } = todayProgress(save);
  // 连击只在展示时校正，落盘由设置页/结算流程负责
  const streak = reconcileStreak(save.stats).streak;

  useEffect(() => {
    if (!save.settings.onboarded) go({ page: "onboarding" }, true);
  }, [save.settings.onboarded]);

  const book = books?.find((b) => b.id === save.settings.activeBook) ?? null;
  const plan = books ? buildPlan(save, books) : null;
  // 已结算完的会话仍留在 save 里等 Task 14 收尾，这里不能当成"可继续"
  const live = save.session && !save.session.finished ? save.session : null;
  const state = homeState(books?.length ?? null, plan?.total ?? null, done, goal, !!live);

  const bed = useMemo(() => {
    if (!book) return null;
    const unit = book.units.find((u) => progressOf(u.wordIds, save.cards).bloomed < u.wordIds.length) ?? book.units[0];
    return unit ? { unit, progress: progressOf(unit.wordIds, save.cards), bookLabel: BOOK_LABEL[book.id] } : null;
  }, [book, save.cards]);

  const ready = state === "ready";

  const start = () => {
    if (!ready || !books) return;
    if (!live) startSession(books);
    go({ page: "learn" });
  };

  const heading =
    state === "done" ? "今天的种子浇完啦"
      : state === "all-learned" ? "整片花圃都开满了"
        : state === "failed" ? "课本暂时打不开"
          : state === "loading" ? "正在打开课本"
            : "今天还有种子等着你";

  const note =
    state === "done" ? "明天再来浇水吧。"
      : state === "all-learned" ? "八册的词都种下了。"
        : state === "failed" ? "刷新后就能继续了。"
          : state === "loading" ? "马上就好。"
            : live ? "上次没学完，接着来。" : `约 ${Math.max(3, Math.round((goal - done) * 0.8))} 分钟`;

  const action =
    state === "done" ? "今天学完啦"
      : state === "all-learned" ? "全部学完啦"
        : live ? "继续学习" : "开始学习";

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">今天也来浇浇水</p>
          <h1>你好，小园丁</h1>
        </div>
        <div className="streak" aria-label={`连续学习 ${streak} 天`}>
          🔥 <strong>{streak}</strong> 天
        </div>
      </header>

      <section className="card today-ring">
        <Ring value={done} max={goal} label={`/ ${goal} 词`} />
        <div className="today-ring-copy">
          <h2>{heading}</h2>
          <p>{note}</p>
          <button type="button" className="btn-primary" onClick={start} disabled={!ready}>
            {action}
          </button>
        </div>
      </section>

      {state === "failed" && (
        <section className="card empty-card">
          <p>教材没加载出来，刷新再试一次。</p>
          <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>刷新</button>
        </section>
      )}

      {state === "all-learned" && (
        <section className="card empty-card">
          <p>八册的词都种下了。</p>
          <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>切换花圃</button>
        </section>
      )}

      {bed && (
        <section className="card">
          <div className="card-head">
            <h2>{bed.bookLabel} · {bed.unit.titleZh || bed.unit.title}</h2>
            <span className="muted">{bed.progress.bloomed}/{bed.progress.total} 开花</span>
          </div>
          <div className="bed-preview">
            {bed.unit.wordIds.slice(0, 8).map((id) => (
              <Sprout key={id} stage={stageOf(save.cards[id])} size={34} />
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => go({ page: "garden", book: book?.id })}>
            看看整片花圃
          </button>
        </section>
      )}
    </main>
  );
}
