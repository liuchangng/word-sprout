import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("残缺百分号编码回首页而不是抛错", () => {
    expect(parseHash("#/word/%")).toEqual({ page: "today" });
    expect(parseHash("#/word/%E4")).toEqual({ page: "today" });
  });
});

describe("href", () => {
  it("往返一致", () => {
    for (const route of [{ page: "learn" as const }, { page: "garden" as const, book: "5B" as const }, { page: "word" as const, id: "w:hi" }]) {
      expect(parseHash(href(route))).toEqual(route);
    }
  });
});

describe("go", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("目标与当前 hash 相同时不重复入栈", async () => {
    const pushState = vi.fn();
    vi.stubGlobal("location", { hash: "#/garden" });
    vi.stubGlobal("window", { addEventListener: vi.fn(), scrollTo: vi.fn() });
    vi.stubGlobal("history", { pushState, replaceState: vi.fn() });
    vi.resetModules();

    const { go } = await import("./router");
    go({ page: "garden" });
    expect(pushState).not.toHaveBeenCalled();

    go({ page: "me" });
    expect(pushState).toHaveBeenCalledWith(null, "", "#/me");
  });
});

