import { describe, expect, it } from "vitest";
import { href, parseHash } from "./router";

describe("parseHash", () => {
  it("空 hash 回首页", () => {
    expect(parseHash("")).toEqual({ page: "today" });
    expect(parseHash("#/")).toEqual({ page: "today" });
  });

  it("解析花圃与册参数", () => {
    expect(parseHash("#/garden?book=4A")).toEqual({ page: "garden", book: "4A" });
    expect(parseHash("#/garden")).toEqual({ page: "garden", book: undefined });
  });

  it("解析词卡 id", () => {
    expect(parseHash("#/word/w%3Aapple")).toEqual({ page: "word", id: "w:apple" });
  });

  it("未知路径回首页", () => {
    expect(parseHash("#/nope")).toEqual({ page: "today" });
  });
});

describe("href", () => {
  it("往返一致", () => {
    for (const route of [{ page: "learn" as const }, { page: "garden" as const, book: "5B" as const }, { page: "word" as const, id: "w:hi" }]) {
      expect(parseHash(href(route))).toEqual(route);
    }
  });
});
