import { catalog, nextWordIds } from "../data/catalog";
import type { Book, Word } from "../data/types";
import { Rating, review, type Grade } from "./srs";
import { bumpDay, dayKey, settledToday } from "./stats";
import { actions, type SaveFile } from "./store";

export type StepKind = "listen" | "meaning" | "spell" | "reveal";

export interface Step {
  wordId: string;
  kind: StepKind;
  options?: string[];
  retry?: boolean;
}

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  graded: Record<string, Grade>;
  newIds: string[];
  reviewIds: string[];
  errors: Record<string, number>;
  pending?: { correct: boolean };
  finished?: number;
}

export interface Plan {
  due: string[];
  fresh: string[];
  total: number;
}

const wordOf = (id: string): Word | undefined => catalog.byId.get(id);

/** 词 id 的稳定哈希，用于打散正确选项的位置，同一 now 下结果可复现。 */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function optionSet(word: Word, pool: Word[], seed: number): string[] {
  const picks: string[] = [];
  const seen = new Set([word.zh]);
  for (let i = 0; i < pool.length * 2 && picks.length < 3; i++) {
    const w = pool[(seed + i * 13) % pool.length];
    if (!w || seen.has(w.zh)) continue;
    seen.add(w.zh);
    picks.push(w.zh);
  }
  const all = [word.zh, ...picks];
  // 纯 seed 轮转会让正确项按固定步长走位，混入词 id 哈希打散
  const rotate = (Math.abs(seed) + hashId(word.id)) % all.length;
  return [...all.slice(rotate), ...all.slice(0, rotate)];
}

/** 复习优先，最多占目标 60%，剩余补新词。 */
export function buildPlan(save: SaveFile, books: Book[], now = Date.now()): Plan {
  const cap = Math.ceil(save.settings.dailyGoal * 0.6);
  const due = Object.entries(save.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id)
    .slice(0, cap);
  const learned = new Set(Object.keys(save.cards));
  const left = Math.max(0, save.settings.dailyGoal - settledToday(save.stats, new Date(now)) - due.length);
  const fresh = nextWordIds(left, learned, save.settings.activeBook, books);
  return { due, fresh, total: due.length + fresh.length };
}

export function buildSession(save: SaveFile, books: Book[], now = Date.now()): ActiveSession {
  const plan = buildPlan(save, books, now);
  const book = books.find((b) => b.id === save.settings.activeBook) ?? books[0];
  const pool = (book?.units ?? []).flatMap((u) => u.wordIds).map(wordOf).filter((w): w is Word => !!w);
  // 干扰项要求 4 个不同中文义项；本册义项重复太多时退回全词库
  const optionPool = new Set(pool.map((w) => w.zh)).size >= 4 ? pool : catalog.words;
  const steps: Step[] = [];
  let seed = now % 9973;

  for (const id of [...plan.due, ...plan.fresh]) {
    const word = wordOf(id);
    if (!word) continue;
    seed += 7;
    steps.push({ wordId: id, kind: "listen" });
    steps.push({ wordId: id, kind: "meaning", options: optionSet(word, optionPool, seed) });
    steps.push({ wordId: id, kind: "spell" });
    steps.push({ wordId: id, kind: "reveal" });
  }

  return {
    id: `s${now}`,
    started: now,
    steps,
    index: 0,
    graded: {},
    newIds: plan.fresh,
    reviewIds: plan.due,
    errors: {},
  };
}

export function gradeForErrors(errors: number, selfHard: boolean): Grade {
  if (errors >= 2) return Rating.Again;
  if (errors >= 1) return Rating.Hard;
  return selfHard ? Rating.Hard : Rating.Good;
}

export function todayProgress(save: SaveFile, now = new Date()) {
  return { done: settledToday(save.stats, now), goal: save.settings.dailyGoal };
}

/* ---------- store 动作 ---------- */

export function startSession(books: Book[]) {
  actions.update((s) => ({ ...s, session: buildSession(s, books) }));
}

export function answer(correct: boolean) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    const step = sess.steps[sess.index];
    if (!step || (step.kind !== "meaning" && step.kind !== "spell")) return s;
    const errors = correct ? sess.errors : { ...sess.errors, [step.wordId]: (sess.errors[step.wordId] ?? 0) + 1 };
    return { ...s, session: { ...sess, errors, pending: { correct } } };
  });
}

export function next(now = Date.now()) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    // 认读步必须走 finishWord 结算，next 跳过会丢掉这个词的评分与统计
    const step = sess.steps[sess.index];
    if (step?.kind === "reveal") return s;
    const index = sess.index + 1;
    return {
      ...s,
      session: { ...sess, index, pending: undefined, finished: index >= sess.steps.length ? now : undefined },
    };
  });
}

/** 在认读步骤结算本词评分，并在 Again 时追加一次复习。 */
export function finishWord(selfHard: boolean, now = Date.now()) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    const step = sess.steps[sess.index];
    if (!step || step.kind !== "reveal") return s;

    const advance = (steps = sess.steps) => {
      const index = sess.index + 1;
      return {
        ...s,
        session: {
          ...sess, steps, index, pending: undefined,
          finished: index >= steps.length ? now : undefined,
        },
      };
    };

    if (step.retry || sess.graded[step.wordId] !== undefined) return advance();

    const grade = gradeForErrors(sess.errors[step.wordId] ?? 0, selfHard);
    const card = review(s.cards[step.wordId], grade, now);
    const isNew = sess.newIds.includes(step.wordId);
    const stats = bumpDay(
      s.stats,
      { learned: isNew ? 1 : 0, reviewed: 1, correct: grade === Rating.Again ? 0 : 1, total: 1 },
      new Date(now),
    );
    // 显式 Step[] 让追加的 retry 字面量保持 kind 的字面量类型，否则 tsc 会推成 string
    const steps: Step[] =
      grade === Rating.Again ? [...sess.steps, { wordId: step.wordId, kind: "reveal", retry: true }] : sess.steps;

    return {
      ...s,
      cards: { ...s.cards, [step.wordId]: card },
      stats,
      session: {
        ...sess, steps, errors: sess.errors, graded: { ...sess.graded, [step.wordId]: grade },
        index: sess.index + 1, pending: undefined,
        finished: sess.index + 1 >= steps.length ? now : undefined,
      },
    };
  });
}

export function abortSession() {
  actions.update((s) => ({ ...s, session: null }));
}

/** 今天是否还有可学内容，用于首页按钮文案。 */
export function hasMoreToday(save: SaveFile, books: Book[]) {
  const plan = buildPlan(save, books);
  return plan.total > 0;
}

export const dayStamp = () => dayKey();
