import { describe, expect, it } from "vitest";
import { mergeWords, normalizeId, parseAppendix, parseEntry } from "./parse-appendix.mjs";

const SAMPLE = `
Words in each unit
Unit 1 Making friends
hello /həˈləʊ/ 你好 p. 4
*hi /haɪ/ 嗨 p. 4
I’m /aɪm/ 我是 p. 5
Unit 2 Different families
mum /mʌm/ 妈妈 p. 12
dad /dæd/ n. 爸爸 p. 12
*grandma /ˈɡrænmɑː/ 奶奶；
*姥姥
p. 16
*grandfather /ˈɡrænfɑːðə(r)/
爷爷；姥爷
p. 16
Useful expressions
Good morning! 早上好！
`;

describe("parseEntry", () => {
  it("解析普通词条", () => {
    expect(parseEntry("hello /həˈləʊ/ 你好 p. 4")).toEqual({
      core: false, text: "hello", ipa: "həˈləʊ", zh: "你好", pos: undefined,
    });
  });

  it("解析带星标的课标词", () => {
    expect(parseEntry("*hi /haɪ/ 嗨 p. 4")?.core).toBe(true);
  });

  it("解析带词性的词条", () => {
    expect(parseEntry("dad /dæd/ n. 爸爸 p. 12")?.pos).toBe("n");
  });

  it("保留撇号短语", () => {
    expect(parseEntry("I’m /aɪm/ 我是 p. 5")?.text).toBe("I’m");
  });

  it("拒绝页码与标题行", () => {
    expect(parseEntry("12")).toBeNull();
    expect(parseEntry("Unit 1 Making friends")).toBeNull();
    expect(parseEntry("Good morning! 早上好！")).toBeNull();
  });
});

describe("parseAppendix", () => {
  it("按单元切分并在常用表达前停止", () => {
    const units = parseAppendix(SAMPLE);
    expect(units.map((u) => u.no)).toEqual([1, 2]);
    expect(units[0].title).toBe("Making friends");
    expect(units[0].entries).toHaveLength(3);
    expect(units[1].entries.map((e) => e.text)).toEqual(["mum", "dad", "grandma", "grandfather"]);
  });

  it("拼接跨行词条，保留全部中文义项", () => {
    const units = parseAppendix(SAMPLE);
    const words = Object.fromEntries(units[1].entries.map((e) => [e.text, e]));
    expect(words.grandma.zh).toBe("奶奶； 姥姥");
    expect(words.grandfather.zh).toBe("爷爷； 姥爷");
    expect(words.grandfather.ipa).toBe("ˈɡrænfɑːðə(r)");
  });
});

describe("parseAppendix 行内第二词条", () => {
  it("拆分同一行内的第二个词条", () => {
    const text = `Unit 1
agree /əˈɡriː/ 同意；结束
完成；结束finish /ˈfɪnɪʃ/ 完成；结束
p. 16
`;
    const units = parseAppendix(text);
    expect(units[0].entries.map((e) => e.text)).toEqual(["agree", "finish"]);
    expect(units[0].entries[1].ipa).toBe("ˈfɪnɪʃ");
  });

  it("忽略续行上的独立星标", () => {
    const text = `Unit 1
*computer /kəmˈpjuːtə(r)/
*计算机；电脑
p. 33
`;
    const units = parseAppendix(text);
    expect(units[0].entries[0].text).toBe("computer");
    expect(units[0].entries[0].core).toBe(true);
  });
});

describe("normalizeId", () => {
  it("统一大小写、空格与撇号", () => {
    expect(normalizeId("  I’m   Fine ")).toBe("w:i'm fine");
  });
});

describe("mergeWords", () => {
  it("跨册同词合并并累积单元", () => {
    const words = mergeWords([
      { id: "3A", units: [{ no: 1, title: "", entries: [{ core: false, text: "apple", ipa: "ˈæpl", zh: "苹果" }] }] },
      { id: "4A", units: [{ no: 2, title: "", entries: [{ core: true, text: "Apple", ipa: "", zh: "", pos: undefined }] }] },
    ]);
    expect(words).toHaveLength(1);
    expect(words[0].units).toEqual(["3A-U1", "4A-U2"]);
    expect(words[0].core).toBe(true);
    expect(words[0].ipa).toBe("ˈæpl");
  });
});
