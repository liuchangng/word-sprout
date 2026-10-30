import { getWord } from "../data/catalog";
import type { BookId } from "../data/types";
import { go } from "../lib/router";
import { firstLetter } from "../lib/text";
import { stageOf, STAGE_LABEL } from "../store/garden";
import { useSave } from "../store/store";
import { Speak } from "../ui/Speak";
import { Sprout } from "../ui/Sprout";

const BOOK_NAME: Record<string, string> = {
  "3A": "三年级上册", "3B": "三年级下册", "4A": "四年级上册", "4B": "四年级下册",
  "5A": "五年级上册", "5B": "五年级下册", "6A": "六年级上册", "6B": "六年级下册",
};

const unitLabel = (uid: string) => {
  // uid 形如 "4B-U5"，按 "-" 拆成 book="4B"、unit="U5"
  const [book, unit] = uid.split("-");
  const n = Number(unit?.replace("U", ""));
  return `${BOOK_NAME[book] ?? book} ${n ? n : ""} 单元`;
};

export function Word({ id }: { id: string }) {
  const save = useSave((s) => s);
  const word = getWord(id);
  if (!word) {
    return (
      <main className="app-shell">
        <p>没有找到这个词。</p>
        <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>回花圃</button>
      </main>
    );
  }
  const stage = stageOf(save.cards[word.id]);
  // 从词卡返回时带回它所属的册，别跳回当前在学的另一册
  const backBook = word.units[0]?.split("-")[0] as BookId | undefined;

  return (
    <main className="app-shell">
      <button type="button" className="btn-ghost" onClick={() => go({ page: "garden", book: backBook })}>返回</button>
      <section className="card word-card">
        <div className="big-emoji">{word.emoji ? <img src={`${import.meta.env.BASE_URL}emoji/${word.emoji}.svg`} alt="" width={132} height={132} /> : <span>{firstLetter(word.text)}</span>}</div>
        <h1>{word.text}</h1>
        {word.ipa && <p className="ipa">/{word.ipa}/</p>}
        <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
        <p className="meaning">{word.pos ? `${word.pos}. ` : ""}{word.zh}</p>
        {word.example && (
          <p className="example">
            {word.example.en}
            {word.example.zh && (
              <>
                <br />
                <span className="muted">{word.example.zh}</span>
              </>
            )}
          </p>
        )}
        <div className="word-stage">
          <Sprout stage={stage} size={44} />
          <span className="muted">{STAGE_LABEL[stage]}</span>
        </div>
      </section>

      <section className="card">
        <h2>出现在</h2>
        <ul className="unit-tags">
          {word.units.map((u) => <li key={u}>{unitLabel(u)}</li>)}
        </ul>
      </section>
    </main>
  );
}
