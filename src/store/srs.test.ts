import { describe, expect, it } from "vitest";
import { formatInterval, MASTERED_STABILITY, Rating, review, isMastered } from "./srs";

const DAY = 86400000;
const now = Date.UTC(2026, 0, 1);

describe("review", () => {
  it("首次 Good 产生可复习的卡片", () => {
    const c = review(undefined, Rating.Good, now);
    expect(c.reps).toBe(1);
    expect(c.seen).toBe(now);
    expect(c.due).toBeGreaterThan(now);
  });

  it("再次 Good 提高稳定度", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Good, now + DAY);
    expect(c2.s).toBeGreaterThan(c1.s);
  });

  it("Again 降低稳定度", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Again, now + DAY);
    expect(c2.s).toBeLessThan(c1.s);
  });

  it("seen 只记录第一次", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Good, now + DAY);
    expect(c2.seen).toBe(now);
  });
});

describe("isMastered", () => {
  it("稳定度达到阈值且有复习记录才算掌握", () => {
    expect(isMastered(undefined)).toBe(false);
    expect(isMastered({ due: now, s: MASTERED_STABILITY, d: 5, el: 0, sd: 1, ls: 0, reps: 3, lapses: 0, st: 2, seen: now })).toBe(true);
    expect(isMastered({ due: now, s: MASTERED_STABILITY - 1, d: 5, el: 0, sd: 1, ls: 0, reps: 3, lapses: 0, st: 2, seen: now })).toBe(false);
  });
});

describe("formatInterval", () => {
  it("按量级返回中文", () => {
    expect(formatInterval(30 * 1000)).toBe("<1分");
    expect(formatInterval(5 * 60000)).toBe("5分");
    expect(formatInterval(3 * DAY)).toBe("3天");
  });
});
