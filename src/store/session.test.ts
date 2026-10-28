import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import type { Book, BookId } from "../data/types";
import { Rating } from "./srs";
import { emptySave } from "./store";
import { buildPlan, buildSession, gradeForErrors, todayProgress } from "./session";

const book = (id: BookId, units: string[][]): Book => ({
  id,
  grade: Number(id[0]) as 3 | 4 | 5 | 6,
  term: id.endsWith("A") ? "上" : "下",
  edition: 2024,
  units: units.map((ids, i) => ({ id: `${id}-U${i + 1}`, no: i + 1, title: `Unit ${i + 1}`, titleZh: "", wordIds: ids })),
});

const ids = catalog.words.slice(0, 12).map((w) => w.id);
const books = [book("3A", [ids.slice(0, 6), ids.slice(6, 12)])];

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
