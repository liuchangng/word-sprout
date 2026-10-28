import { beforeEach, describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import type { Book, BookId } from "../data/types";
import { Rating } from "./srs";
import { dayKey } from "./stats";
import { actions, emptySave, getSave } from "./store";
import {
  abortSession,
  answer,
  buildPlan,
  buildSession,
  finishWord,
  gradeForErrors,
  next,
  startSession,
  todayProgress,
} from "./session";

const book = (id: BookId, units: string[][]): Book => ({
  id,
  grade: Number(id[0]) as 3 | 4 | 5 | 6,
  term: id.endsWith("A") ? "上" : "下",
  edition: 2024,
  units: units.map((ids, i) => ({ id: `${id}-U${i + 1}`, no: i + 1, title: `Unit ${i + 1}`, titleZh: "", wordIds: ids })),
});

const ids = catalog.words.slice(0, 12).map((w) => w.id);
const books = [book("3A", [ids.slice(0, 6), ids.slice(6, 12)])];
// 单词本，用于精确断言会话步骤
const solo = [book("3A", [[ids[0]]])];
// 义项高度重复的册子：6 个词只有 3 种中文，用于验证干扰项兜底
const dupIds = ["w:a few", "w:some", "w:before", "w:by", "w:cap", "w:hat"];
const dupBook = [book("3A", [dupIds])];

const dueCard = (due: number) => ({ due, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1 as const, seen: 0 });

/** 从当前步一路走到会话结束，答对全部题目。 */
function play() {
  for (let guard = 0; guard < 500; guard++) {
    const sess = getSave().session;
    if (!sess || sess.finished !== undefined) return;
    const step = sess.steps[sess.index];
    if (!step) return;
    if (step.kind === "meaning" || step.kind === "spell") answer(true);
    if (step.kind === "reveal") finishWord(false);
    else next();
  }
  throw new Error("会话没有正常结束");
}

/** 走到当前词的认读步，meaning / spell 按 correct 作答。 */
function toReveal(correct: boolean) {
  next(); // listen
  answer(correct);
  next(); // meaning
  answer(correct);
  next(); // spell -> reveal
}

describe("buildPlan", () => {
  it("新用户取满每日目标", () => {
    const plan = buildPlan(emptySave(), books);
    expect(plan.fresh).toHaveLength(10);
    expect(plan.due).toHaveLength(0);
  });

  it("到期复习不超过目标的 60%", () => {
    const save = emptySave();
    const now = Date.now();
    for (const id of ids) {
      save.cards[id] = { due: now - 1000, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1, seen: 0 };
    }
    expect(buildPlan(save, books, now).due).toHaveLength(6);
  });

  it("当天已学部分后不再补满", () => {
    const save = emptySave();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    save.stats.days[key] = { learned: 7, reviewed: 0, correct: 0, total: 0 };
    expect(buildPlan(save, books).fresh).toHaveLength(3);
  });

  it("全部学完返回空计划", () => {
    const save = emptySave();
    for (const id of ids) save.cards[id] = { due: Date.now() + 86400000, s: 5, d: 5, el: 0, sd: 1, ls: 0, reps: 2, lapses: 0, st: 2, seen: 0 };
    expect(buildPlan(save, books).fresh).toHaveLength(0);
  });
});

describe("buildSession", () => {
  it("每个词四步，顺序为听、选义、拼写、认读", () => {
    const s = buildSession(emptySave(), books);
    const first = s.steps.slice(0, 4).map((x) => x.kind);
    expect(first).toEqual(["listen", "meaning", "spell", "reveal"]);
    expect(s.steps).toHaveLength(s.newIds.length * 4);
  });

  it("选义题有四个互不相同的选项且包含正确答案", () => {
    const s = buildSession(emptySave(), books);
    const step = s.steps.find((x) => x.kind === "meaning")!;
    expect(step.options).toHaveLength(4);
    expect(new Set(step.options).size).toBe(4);
    expect(step.options).toContain(catalog.byId.get(step.wordId)!.zh);
  });
});

describe("gradeForErrors", () => {
  it("零错为 Good，一错为 Hard，两错为 Again", () => {
    expect(gradeForErrors(0, false)).toBe(Rating.Good);
    expect(gradeForErrors(1, false)).toBe(Rating.Hard);
    expect(gradeForErrors(2, false)).toBe(Rating.Again);
    expect(gradeForErrors(5, false)).toBe(Rating.Again);
  });

  it("自评有点难时最多 Hard", () => {
    expect(gradeForErrors(0, true)).toBe(Rating.Hard);
  });
});

describe("todayProgress", () => {
  it("没有记录时从 0 开始", () => {
    expect(todayProgress(emptySave())).toEqual({ done: 0, goal: 10 });
  });
});

describe("每日目标计入复习", () => {
  it("复习已结算的卡片计入进度，重启后不再补满", () => {
    const save = emptySave();
    const now = Date.now();
    // 6 个词已学过且未到期（即今天已复习完），当日只有复习记录
    for (const id of ids.slice(0, 6)) save.cards[id] = dueCard(now + 86400000);
    save.stats.days[dayKey()] = { learned: 0, reviewed: 6, correct: 6, total: 6 };
    expect(buildPlan(save, books, now).fresh).toHaveLength(4);
    expect(todayProgress(save).done).toBe(6);
  });

  it("混合会话结束后 done 等于已结算词数而非新词数", () => {
    const save = emptySave();
    const now = Date.now();
    for (const id of ids.slice(0, 4)) save.cards[id] = dueCard(now - 1000);
    actions.replace(save);
    startSession(books);
    const sess = getSave().session!;
    expect(sess.reviewIds).toHaveLength(4);
    expect(sess.newIds).toHaveLength(6);

    play();

    const after = getSave();
    expect(after.stats.days[dayKey()]).toMatchObject({ learned: 6, reviewed: 10, total: 10 });
    expect(todayProgress(after)).toEqual({ done: 10, goal: 10 });
  });
});

describe("会话动作", () => {
  beforeEach(() => actions.replace(emptySave()));

  it("Again 只追加一次复习步，Hard 不追加", () => {
    startSession(solo);
    toReveal(false);
    finishWord(false);
    let s = getSave();
    expect(s.session!.steps).toHaveLength(5);
    expect(s.session!.steps.filter((x) => x.retry)).toHaveLength(1);
    expect(s.session!.steps[4]).toMatchObject({ wordId: ids[0], kind: "reveal", retry: true });

    actions.replace(emptySave());
    startSession(solo);
    toReveal(true);
    finishWord(true);
    s = getSave();
    expect(s.session!.steps).toHaveLength(4);
    expect(s.session!.steps.filter((x) => x.retry)).toHaveLength(0);
    expect(s.session!.graded[ids[0]]).toBe(Rating.Hard);
  });

  it("retry 步不重复写卡也不重复计统计", () => {
    startSession(solo);
    toReveal(false);
    finishWord(false);
    const once = getSave();
    expect(once.cards[ids[0]].reps).toBe(1);
    expect(once.stats.days[dayKey()]).toMatchObject({ learned: 1, reviewed: 1, correct: 0, total: 1 });

    finishWord(false);
    const twice = getSave();
    expect(twice.cards[ids[0]].reps).toBe(1);
    expect(twice.stats.days[dayKey()]).toMatchObject({ learned: 1, reviewed: 1, correct: 0, total: 1 });
  });

  it("消费掉末尾 retry 步后会话结束", () => {
    startSession(solo);
    toReveal(false);
    finishWord(false);
    expect(getSave().session!.finished).toBeUndefined();
    expect(getSave().session!.index).toBe(4);

    finishWord(false, 12345);
    const s = getSave();
    expect(s.session!.index).toBe(5);
    expect(s.session!.finished).toBe(12345);
  });

  it("abortSession 保留已结算卡片并清空会话", () => {
    startSession(solo);
    toReveal(true);
    finishWord(false);
    expect(getSave().cards[ids[0]]).toBeDefined();

    abortSession();
    expect(getSave().session).toBeNull();
    expect(getSave().cards[ids[0]]).toBeDefined();
  });

  it("next 在认读步不推进", () => {
    startSession(solo);
    toReveal(true);
    const idx = getSave().session!.index;
    expect(getSave().session!.steps[idx].kind).toBe("reveal");

    next();
    expect(getSave().session!.index).toBe(idx);
    expect(getSave().session!.finished).toBeUndefined();
  });
});

describe("选义题干扰项", () => {
  it("本册义项不足 4 种时退回全词库", () => {
    const s = buildSession(emptySave(), dupBook, 1234567);
    expect(s.newIds).toHaveLength(6);
    const meanings = s.steps.filter((x) => x.kind === "meaning");
    expect(meanings).toHaveLength(6);
    for (const step of meanings) {
      expect(step.options).toHaveLength(4);
      expect(new Set(step.options).size).toBe(4);
      expect(step.options).toContain(catalog.byId.get(step.wordId)!.zh);
    }
  });

  it("同一 now 生成的选项完全一致", () => {
    const a = buildSession(emptySave(), books, 1234567);
    const b = buildSession(emptySave(), books, 1234567);
    expect(a.steps).toEqual(b.steps);
  });

  it("正确选项位置不按固定步长循环", () => {
    const s = buildSession(emptySave(), books, 1234567);
    const pos = s.steps
      .filter((x) => x.kind === "meaning")
      .map((x) => x.options!.indexOf(catalog.byId.get(x.wordId)!.zh));
    expect(pos).toHaveLength(10);
    expect(pos.every((p) => p >= 0 && p < 4)).toBe(true);
    const stepOf = (a: number, b: number) => (((b - a) % 4) + 4) % 4;
    const moves = pos.slice(1).map((p, i) => stepOf(pos[i], p));
    expect(new Set(moves).size).toBeGreaterThan(1);
  });
});
