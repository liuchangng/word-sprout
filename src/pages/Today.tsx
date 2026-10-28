import { useEffect, useMemo } from "react";
import { useAllBooks } from "../data/useBooks";
import { go } from "../lib/router";
import { progressOf, stageOf } from "../store/garden";
import { buildPlan, startSession, todayProgress } from "../store/session";
import { useSave } from "../store/store";
import { Ring } from "../ui/Ring";
import { Sprout } from "../ui/Sprout";

export function Today() {
  const save = useSave((s) => s);
  const books = useAllBooks();
  const { done, goal } = todayProgress(save);

  useEffect(() => {
    if (!save.settings.onboarded) go({ page: "onboarding" }, true);
  }, [save.settings.onboarded]);

  const book = books?.find((b) => b.id === save.settings.activeBook) ?? null;
  const plan = books ? buildPlan(save, books) : null;

  const bed = useMemo(() => {
    if (!book) return null;
    const unit = book.units.find((u) => progressOf(u.wordIds, save.cards).bloomed < u.wordIds.length) ?? book.units[0];
    return unit ? { unit, progress: progressOf(unit.wordIds, save.cards) } : null;
  }, [book, save.cards]);

  const start = () => {
    if (!books) return;
    if (!save.session) startSession(books);
    go({ page: "learn" });
  };

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">今天也来浇浇水</p>
          <h1>你好，小园丁</h1>
        </div>
        <div className="streak" aria-label={`连续学习 ${save.stats.streak} 天`}>
          🔥 <strong>{save.stats.streak}</strong> 天
        </div>
      </header>

      <section className="card today-ring">
        <Ring value={done} max={goal} label={`/ ${goal} 词`} />
        <div className="today-ring-copy">
          <h2>{done >= goal ? "今天的种子浇完啦" : "今天还有种子等着你"}</h2>
          <p>{save.session ? "上次没学完，接着来。" : `约 ${Math.max(3, Math.round((goal - done) * 0.8))} 分钟`}</p>
          <button type="button" className="btn-primary" onClick={start} disabled={!books}>
            {save.session ? "继续学习" : done >= goal ? "再学一组" : "开始学习"}
          </button>
        </div>
      </section>

      {bed && (
        <section className="card">
          <div className="card-head">
            <h2>{bed.unit.titleZh || bed.unit.title}</h2>
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

      {plan && plan.total === 0 && (
        <section className="card empty-card">
          <p>这本书的词都种下啦，去下一册看看吧。</p>
          <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>切换花圃</button>
        </section>
      )}
    </main>
  );
}
