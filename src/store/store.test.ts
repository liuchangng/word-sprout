import { describe, expect, it } from "vitest";
import { defaultSettings, emptySave, parseBackup, sanitizeSave, serializeBackup } from "./store";

const validCard = {
  due: 1, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1, seen: 1,
} as const;

describe("emptySave", () => {
  it("默认 10 词、三上、未引导", () => {
    const s = emptySave();
    expect(s.settings.dailyGoal).toBe(10);
    expect(s.settings.activeBook).toBe("3A");
    expect(s.settings.onboarded).toBe(false);
    expect(s.cards).toEqual({});
    expect(s.stats.streak).toBe(0);
  });
});

describe("sanitizeSave", () => {
  it("丢弃非法卡片，保留合法卡片", () => {
    const s = sanitizeSave({ v: 1, cards: { ok: validCard, bad: { due: "x" } } });
    expect(Object.keys(s.cards)).toEqual(["ok"]);
  });

  it("修正越界设置", () => {
    const s = sanitizeSave({
      v: 1,
      settings: { dailyGoal: 99, activeBook: "9Z", accent: "xx", rate: 5, motion: "off" },
    });
    expect(s.settings.dailyGoal).toBe(10);
    expect(s.settings.activeBook).toBe("3A");
    expect(s.settings.accent).toBe("uk");
    expect(s.settings.rate).toBe(0.8);
    expect(s.settings.motion).toBe("off");
  });

  it("版本不符时返回空存档", () => {
    expect(sanitizeSave({ v: 2, cards: { a: validCard } }).cards).toEqual({});
  });

  it("接受合法的统计与设置", () => {
    const s = sanitizeSave({
      v: 1,
      settings: { dailyGoal: 15, activeBook: "5B", accent: "us", rate: 0.9, onboarded: true },
      cards: { a: validCard },
      stats: { days: { "2026-03-01": { learned: 2, reviewed: 1, correct: 2, total: 3 } }, streak: 4, lastDay: "2026-03-01" },
    });
    expect(s.settings.dailyGoal).toBe(15);
    expect(s.settings.activeBook).toBe("5B");
    expect(s.stats.streak).toBe(4);
  });
});

describe("backup", () => {
  it("导出后能完整导入，且不包含进行中的会话", () => {
    const save = { ...emptySave(), cards: { a: validCard }, session: { id: "s1" } as never };
    const text = serializeBackup(save);
    expect(text).not.toContain('"session"');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.save.cards.a.reps).toBe(1);
  });

  it("拒绝非 JSON", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, error: "文件不是有效 JSON" });
  });

  it("拒绝其他应用的备份", () => {
    expect(parseBackup(JSON.stringify({ app: "word-atlas", version: 1 }))).toEqual({
      ok: false,
      error: "这不是词芽的备份文件",
    });
  });
});

describe("defaultSettings", () => {
  it("语速 1，口音英式", () => {
    expect(defaultSettings.rate).toBe(0.8);
    expect(defaultSettings.accent).toBe("uk");
  });
});
