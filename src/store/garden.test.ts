import { describe, expect, it } from "vitest";
import { progressOf, stageOf } from "./garden";
import type { CardState } from "./srs";

const card = (patch: Partial<CardState>): CardState => ({
  due: 0, s: 0, d: 5, el: 0, sd: 0, ls: 0, reps: 0, lapses: 0, st: 1, seen: 0, ...patch,
});

describe("stageOf", () => {
  it("没有卡片是种子", () => {
    expect(stageOf(undefined)).toBe(0);
    expect(stageOf(card({ reps: 0 }))).toBe(0);
  });

  it("学过一次是嫩芽", () => {
    expect(stageOf(card({ reps: 1 }))).toBe(1);
    expect(stageOf(card({ reps: 2, sd: 0 }))).toBe(1);
  });

  it("复习过且间隔至少一天是叶", () => {
    expect(stageOf(card({ reps: 2, sd: 1, s: 3 }))).toBe(2);
  });

  it("稳定度达到 21 天是花", () => {
    expect(stageOf(card({ reps: 3, sd: 5, s: 21 }))).toBe(3);
    expect(stageOf(card({ reps: 3, sd: 5, s: 20.9 }))).toBe(2);
  });
});

describe("progressOf", () => {
  const cards: Record<string, CardState> = {
    a: card({ reps: 3, sd: 5, s: 25 }),
    b: card({ reps: 2, sd: 1, s: 4 }),
    c: card({ reps: 1 }),
  };

  it("统计各阶段数量", () => {
    const p = progressOf(["a", "b", "c", "d"], cards);
    expect(p).toEqual({ total: 4, sprouted: 3, leafed: 2, bloomed: 1, ratio: 0.25 });
  });

  it("空单元不除零", () => {
    expect(progressOf([], cards).ratio).toBe(0);
  });
});
