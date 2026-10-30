import { useEffect, useRef, useState } from "react";
import { unitWords } from "../data/catalog";
import { useAllBooks } from "../data/useBooks";
import type { BookId, Unit } from "../data/types";
import { go } from "../lib/router";
import { progressOf, stageOf } from "../store/garden";
import { useSave } from "../store/store";
import { GardenBed } from "../ui/GardenBed";
import { Sheet } from "../ui/Sheet";
import { Sprout } from "../ui/Sprout";

const BOOK_IDS: BookId[] = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];
const SHORT: Record<BookId, string> = {
  "3A": "三上", "3B": "三下", "4A": "四上", "4B": "四下",
  "5A": "五上", "5B": "五下", "6A": "六上", "6B": "六下",
};

export function Garden({ book: initial }: { book?: BookId }) {
  const save = useSave((s) => s);
  // 路由可能带着 #/garden?book=5B 再次进入且组件保持挂载，路由参数变化时跟随；页内点页签走本地状态
  const [id, setId] = useState<BookId>(initial ?? save.settings.activeBook);
  const [open, setOpen] = useState<Unit | null>(null);
  const tabRefs = useRef(new Map<BookId, HTMLButtonElement>());

  useEffect(() => {
    if (initial) setId(initial);
  }, [initial]);

  // 页签键盘操作：左右键切换相邻页签并保持焦点，符合 role=tab 约定
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const current = BOOK_IDS.indexOf(id);
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = BOOK_IDS.length - 1;
    else next = (current + (e.key === "ArrowRight" ? 1 : -1) + BOOK_IDS.length) % BOOK_IDS.length;
    const target = BOOK_IDS[next];
    setId(target);
    tabRefs.current.get(target)?.focus();
  };

  const books = useAllBooks();
  const book = books?.find((b) => b.id === id) ?? null;

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">花圃</p>
          <h1>看看种到哪了</h1>
        </div>
      </header>

      <div className="book-tabs" role="tablist" aria-label="选择教材" onKeyDown={onKeyDown}>
        {BOOK_IDS.map((b) => (
          <button
            key={b} type="button" role="tab" aria-selected={id === b}
            tabIndex={id === b ? 0 : -1}
            ref={(el) => {
              if (el) tabRefs.current.set(b, el);
              else tabRefs.current.delete(b);
            }}
            className={id === b ? "tab is-on" : "tab"}
            onClick={() => setId(b)}
          >
            {SHORT[b]}
          </button>
        ))}
      </div>

      {!books && (
        <section className="card empty-card">
          <p>正在打开课本，马上就好。</p>
        </section>
      )}

      {books && books.length === 0 && (
        <section className="card empty-card">
          <p>教材没加载出来，刷新再试一次。</p>
          <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>刷新</button>
        </section>
      )}

      {book && (
        <>
          <div className="book-title">
            <h2>{book.grade} 年级{book.term}册</h2>
            {book.edition === 2013 && <span className="badge">旧版</span>}
            {save.settings.activeBook === book.id && <span className="badge badge-green">当前</span>}
          </div>

          <div className="unit-list">
            {book.units.map((unit) => {
              const p = progressOf(unit.wordIds, save.cards);
              return (
                <div key={unit.id} className="card unit-card">
                  <button type="button" className="unit-toggle" onClick={() => setOpen(unit)}>
                    <div className="unit-head">
                      <strong>Unit {unit.no}</strong>
                      <span className="muted">{p.bloomed}/{p.total}</span>
                    </div>
                    <p className="unit-title">{unit.titleZh || unit.title}</p>
                  </button>
                  <div className="unit-bed" aria-hidden="true">
                    <GardenBed wordIds={unit.wordIds} cards={save.cards} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={!!open} title={open ? open.titleZh || open.title : ""} onClose={() => setOpen(null)}>
        {open && book && (
          <ul className="word-list">
            {unitWords(open).map((w) => (
              <li key={w.id}>
                <button type="button" className="word-row" onClick={() => go({ page: "word", id: w.id })}>
                  <Sprout stage={stageOf(save.cards[w.id])} size={30} />
                  <span className="word-row-text">
                    <strong>{w.text}</strong>
                    <span className="muted">{w.zh}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </main>
  );
}
