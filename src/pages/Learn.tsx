import { useEffect, useMemo, useState } from "react";
import { catalog } from "../data/catalog";
import { useAllBooks } from "../data/useBooks";
import { firstLetter, shuffle } from "../lib/text";
import { go } from "../lib/router";
import { speak } from "../lib/speech";
import { answer, abortSession, finishWord, next, startSession } from "../store/session";
import { useSave } from "../store/store";
import { Speak } from "../ui/Speak";

export function Learn() {
  const save = useSave((s) => s);
  const books = useAllBooks();
  const session = save.session;
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (!session && books) startSession(books);
  }, [session, books]);

  const step = session?.steps[session.index];
  const word = step ? catalog.byId.get(step.wordId) : undefined;
  const total = session?.steps.length ?? 0;

  const tiles = useMemo(() => {
    if (!word) return [];
    const letters = word.text.toLowerCase().replace(/[^a-z']/g, "").split("");
    return shuffle(letters, (step?.wordId.length ?? 1) * 31 + (session?.index ?? 0));
  }, [word, step?.wordId, session?.index]);

  // 重试 reveal 步会复用旧的 index，同一词也可能重复出现，所以同时以词 id 重置
  useEffect(() => {
    setPicked([]);
  }, [session?.index, step?.wordId]);

  // 听音步进入时自动朗读一次；emoji 脉冲动画尚不存在，无需处理 motion 设置
  useEffect(() => {
    if (step?.kind === "listen" && word) {
      speak(word.text, { accent: save.settings.accent, rate: save.settings.rate });
    }
  }, [step?.wordId, step?.kind]);

  if (!session) {
    return <main className="learn"><p className="muted">正在准备种子…</p></main>;
  }

  if (session.finished) {
    const graded = Object.values(session.graded);
    const correct = graded.filter((g) => g !== 1).length;
    return (
      <main className="learn learn-done">
        <h1>今天的花长出来了</h1>
        <p className="muted">复习 {graded.length} 个词，答对 {correct} 个</p>
        <p className="muted">新长的芽 {session.newIds.length} 个，复习词 {session.reviewIds.length} 个</p>
        <div className="done-sprouts">
          {session.newIds.slice(0, 10).map((id) => <span key={id}>🌱</span>)}
        </div>
        <button type="button" className="btn-primary wide" onClick={() => go({ page: "today" })}>回花园</button>
      </main>
    );
  }

  if (!step || !word) {
    return <main className="learn"><button type="button" className="btn-primary" onClick={() => go({ page: "today" })}>回花园</button></main>;
  }

  const progress = Math.round((session.index / Math.max(1, total)) * 100);

  const build = picked.map((i) => tiles[i]).join("");
  const target = word.text.toLowerCase().replace(/[^a-z']/g, "");

  // pending 由 next() 清除，上一步的残留 pending 不会泄漏到当前步，直接渲染即可
  const hasPending = !!session.pending;

  return (
    <main className="learn">
      <header className="learn-head">
        <button type="button" className="btn-ghost" onClick={() => { abortSession(); go({ page: "today" }); }}>退出</button>
        <div className="learn-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <span className="muted">{session.index + 1}/{total}</span>
      </header>

      {step.kind === "listen" && (
        <section className="learn-card">
          <p className="eyebrow">先听一听</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={132} height={132} /> : <span>{firstLetter(word.text)}</span>}</div>
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={30} />
          <h1>{word.text}</h1>
          <button type="button" className="btn-primary wide" onClick={() => next()}>我听到了</button>
        </section>
      )}

      {step.kind === "meaning" && (
        <section className="learn-card">
          <p className="eyebrow">它是什么意思？</p>
          <h1>{word.text}</h1>
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
          <div className="options">
            {(step.options ?? []).map((opt) => (
              <button
                key={opt} type="button" className="option"
                disabled={hasPending}
                onClick={() => answer(opt === word.zh)}
              >
                {opt}
              </button>
            ))}
          </div>
          {hasPending && <Feedback correct={session.pending!.correct} onNext={() => next()} />}
        </section>
      )}

      {step.kind === "spell" && (
        <section className="learn-card">
          <p className="eyebrow">拼一拼</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={110} height={110} /> : <span>{firstLetter(word.text)}</span>}</div>
          <p className="muted">{word.zh}</p>
          <div className="slots" aria-live="polite">
            {picked.map((i, at) => (
              <button key={`${i}-${at}`} type="button" className="slot" onClick={() => setPicked(picked.filter((_, k) => k !== at))}>{tiles[i]}</button>
            ))}
            {picked.length === 0 && <span className="muted">点下面的字母</span>}
          </div>
          <div className="tiles">
            {tiles.map((ch, i) => (
              <button key={i} type="button" className="tile" disabled={picked.includes(i) || hasPending} onClick={() => setPicked([...picked, i])}>{ch}</button>
            ))}
          </div>
          {!hasPending ? (
            <button type="button" className="btn-primary wide" disabled={picked.length !== tiles.length} onClick={() => answer(build === target)}>检查</button>
          ) : (
            <Feedback correct={session.pending!.correct} onNext={() => next()} />
          )}
        </section>
      )}

      {step.kind === "reveal" && (
        <section className="learn-card">
          <p className="eyebrow">认一认</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={110} height={110} /> : <span>{firstLetter(word.text)}</span>}</div>
          <h1>{word.text}</h1>
          {word.ipa && <p className="ipa">/{word.ipa}/</p>}
          <p className="meaning">{word.pos ? `${word.pos}. ` : ""}{word.zh}</p>
          {word.example && <p className="example">{word.example.en}<br /><span className="muted">{word.example.zh}</span></p>}
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
          <div className="reveal-actions">
            <button type="button" className="btn-ghost" onClick={() => finishWord(true)}>有点难</button>
            <button type="button" className="btn-primary" onClick={() => finishWord(false)}>记住了</button>
          </div>
        </section>
      )}
    </main>
  );
}

function Feedback({ correct, onNext }: { correct: boolean; onNext: () => void }) {
  return (
    <div className={correct ? "feedback is-ok" : "feedback is-bad"} role="status" aria-live="polite">
      <span>{correct ? "对了" : "再记一次"}</span>
      <button type="button" className="btn-primary" onClick={onNext}>继续</button>
    </div>
  );
}
