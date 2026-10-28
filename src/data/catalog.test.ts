import { describe, expect, it } from "vitest";
import { catalog, getWord, nextWordIds, unitWords } from "./catalog";
import type { Book, BookId } from "./types";

const fakeBook = (id: BookId, units: string[][]): Book => ({
  id,
  grade: Number(id[0]) as 3 | 4 | 5 | 6,
  term: id.endsWith("A") ? "上" : "下",
  edition: 2024,
  units: units.map((ids, i) => ({
    id: `${id}-U${i + 1}`,
    no: i + 1,
    title: `Unit ${i + 1}`,
    titleZh: "",
    wordIds: ids,
  })),
});

describe("catalog", () => {
  it("包含 8 本书与去重后的词条", () => {
    expect(catalog.bookIds).toHaveLength(8);
    expect(catalog.words.length).toBeGreaterThan(800);
    expect(new Set(catalog.words.map((w) => w.id)).size).toBe(catalog.words.length);
  });

  it("按 id 取词", () => {
    const w = catalog.words[0];
    expect(getWord(w.id)).toBe(w);
    expect(getWord("w:__missing__")).toBeUndefined();
  });
});

describe("unitWords", () => {
  it("按单元顺序返回词条", () => {
    const book = fakeBook("3A", [["w:b", "w:a"]]);
    const words = unitWords(book.units[0], new Map([
      ["w:a", { id: "w:a", text: "a", ipa: "", zh: "甲", core: false, units: [] }],
      ["w:b", { id: "w:b", text: "b", ipa: "", zh: "乙", core: false, units: [] }],
    ]));
    expect(words.map((w) => w.id)).toEqual(["w:b", "w:a"]);
  });
});

describe("nextWordIds", () => {
  const books = [
    fakeBook("3A", [["w:a", "w:b"], ["w:c"]]),
    fakeBook("3B", [["w:d"]]),
  ];

  it("按册与单元顺序取未学词", () => {
    expect(nextWordIds(2, new Set(["w:a"]), "3A", books)).toEqual(["w:b", "w:c"]);
  });

  it("当前册不足时进入下一册", () => {
    expect(nextWordIds(3, new Set(["w:a", "w:b", "w:c"]), "3A", books)).toEqual(["w:d"]);
  });

  it("全部学完返回空数组", () => {
    expect(nextWordIds(5, new Set(["w:a", "w:b", "w:c", "w:d"]), "3A", books)).toEqual([]);
  });
});
