import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DATA = fileURLToPath(new URL("../src/data", import.meta.url));
const index = JSON.parse(fs.readFileSync(`${DATA}/index.json`, "utf8"));
const books = index.bookIds.map((id) => JSON.parse(fs.readFileSync(`${DATA}/books/${id}.json`, "utf8")));
const words = index.words;
const byId = new Map(words.map((w) => [w.id, w]));

const CJK = /[\u4e00-\u9fff]/;
const PUA = /[\uE000-\uF8FF]/;
// 括号内允许语法说明（如 "（eat 的过去式）"），括号外不允许残留英文单词。
const stripNotes = (zh) => zh.replace(/[（(][^）)]*[）)]/g, "");

describe("curriculum data", () => {
  it("词条总数在预期区间内", () => {
    expect(words.length).toBeGreaterThanOrEqual(850);
    expect(words.length).toBeLessThanOrEqual(900);
  });

  it("词头不含中文或私用区字形", () => {
    const bad = words.filter((w) => CJK.test(w.text) || PUA.test(w.text)).map((w) => w.text);
    expect(bad).toEqual([]);
  });

  it("释义括号外不残留英文单词", () => {
    const bad = words.filter((w) => /[A-Za-z]{3,}/.test(stripNotes(w.zh))).map((w) => `${w.id}: ${w.zh}`);
    expect(bad).toEqual([]);
  });

  it("词条 id 不重复且每条都有归属和释义", () => {
    const ids = words.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(words.filter((w) => w.units.length === 0).map((w) => w.id)).toEqual([]);
    expect(words.filter((w) => !w.text || !w.zh).map((w) => w.id)).toEqual([]);
  });

  it("单元内词条 id 不重复且都能解析", () => {
    const problems = [];
    for (const book of books) {
      for (const unit of book.units) {
        if (new Set(unit.wordIds).size !== unit.wordIds.length) problems.push(`${unit.id}: duplicate wordId`);
        for (const id of unit.wordIds) if (!byId.has(id)) problems.push(`${unit.id}: dangling ${id}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("词条的单元引用都能解析", () => {
    const unitIds = new Set(books.flatMap((b) => b.units.map((u) => u.id)));
    const bad = words.flatMap((w) => w.units.filter((u) => !unitIds.has(u)).map((u) => `${w.id}: ${u}`));
    expect(bad).toEqual([]);
  });

  it("每个单元都有英文和中文标题", () => {
    const bad = books.flatMap((b) => b.units.filter((u) => !u.title || !u.titleZh).map((u) => u.id));
    expect(bad).toEqual([]);
  });

  it("例句来自教材且是完整句子", () => {
    const withExample = words.filter((w) => w.example);
    // 附录词表之外，正文里找不到的短语允许没有例句
    expect(withExample.length / words.length).toBeGreaterThan(0.9);
    const bad = withExample
      .filter((w) => {
        const en = w.example.en;
        return (
          w.example.src !== "textbook" ||
          !en ||
          CJK.test(en) ||
          /_|\.\.\.|…|\s{2,}/.test(en) ||
          !/[.!?]["')\]]?$/.test(en)
        );
      })
      .map((w) => `${w.id}: ${w.example.en}`);
    expect(bad).toEqual([]);
  });
});
