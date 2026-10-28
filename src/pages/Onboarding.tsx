import { useState } from "react";
import type { BookId } from "../data/types";
import { go } from "../lib/router";
import { actions } from "../store/store";

const BOOKS: { id: BookId; label: string }[] = [
  { id: "3A", label: "三年级上册" }, { id: "3B", label: "三年级下册" },
  { id: "4A", label: "四年级上册" }, { id: "4B", label: "四年级下册" },
  { id: "5A", label: "五年级上册" }, { id: "5B", label: "五年级下册" },
  { id: "6A", label: "六年级上册" }, { id: "6B", label: "六年级下册" },
];

const GOALS = [5, 10, 15, 20] as const;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [book, setBook] = useState<BookId>("3A");
  const [goal, setGoal] = useState<5 | 10 | 15 | 20>(10);

  const finish = () => {
    actions.settings({ activeBook: book, dailyGoal: goal, onboarded: true });
    go({ page: "today" }, true);
  };

  return (
    <main className="onboard">
      {step === 0 ? (
        <section>
          <p className="eyebrow">第 1 步，共 2 步</p>
          <h1>你现在用哪一册？</h1>
          <div className="choice-grid">
            {BOOKS.map((b) => (
              <button key={b.id} type="button" className={book === b.id ? "choice is-on" : "choice"} onClick={() => setBook(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary wide" onClick={() => setStep(1)}>下一步</button>
        </section>
      ) : (
        <section>
          <p className="eyebrow">第 2 步，共 2 步</p>
          <h1>每天想学几个词？</h1>
          <div className="choice-grid">
            {GOALS.map((g) => (
              <button key={g} type="button" className={goal === g ? "choice is-on" : "choice"} onClick={() => setGoal(g)}>
                {g} 个
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary wide" onClick={finish}>开始种词</button>
          <button type="button" className="btn-ghost wide" onClick={() => setStep(0)}>上一步</button>
        </section>
      )}
    </main>
  );
}
