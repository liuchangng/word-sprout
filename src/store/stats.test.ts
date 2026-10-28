import { describe, expect, it } from "vitest";
import { bumpDay, dayKey, emptyStats, learnedToday, reconcileStreak } from "./stats";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 10, 0, 0);

describe("dayKey", () => {
  it("使用本地日期并补零", () => {
    expect(dayKey(d(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("bumpDay", () => {
  it("同日多次累加不重复计天", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 3, reviewed: 3, correct: 2, total: 3 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 2, reviewed: 1, correct: 1, total: 1 }, d(2026, 3, 1));
    expect(s.days["2026-03-01"]).toEqual({ learned: 5, reviewed: 4, correct: 3, total: 4 });
    expect(s.streak).toBe(1);
  });

  it("连续第二天累加连击", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 2));
    expect(s.streak).toBe(2);
  });

  it("断档后重新从 1 开始", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 4));
    expect(s.streak).toBe(1);
  });

  it("只有时间没有学习不计入连击", () => {
    const s = bumpDay(emptyStats(), { total: 1 }, d(2026, 3, 1));
    expect(s.streak).toBe(0);
    expect(s.lastDay).toBeNull();
  });
});

describe("reconcileStreak", () => {
  it("昨天学过保持连击", () => {
    const s = reconcileStreak({ days: {}, streak: 4, lastDay: "2026-03-01" }, d(2026, 3, 2));
    expect(s.streak).toBe(4);
  });

  it("隔天未学归零", () => {
    const s = reconcileStreak({ days: {}, streak: 4, lastDay: "2026-03-01" }, d(2026, 3, 3));
    expect(s.streak).toBe(0);
  });
});

describe("learnedToday", () => {
  it("读取当天新学数量", () => {
    const s = bumpDay(emptyStats(), { learned: 7 }, d(2026, 3, 1));
    expect(learnedToday(s, d(2026, 3, 1))).toBe(7);
    expect(learnedToday(s, d(2026, 3, 2))).toBe(0);
  });
});
