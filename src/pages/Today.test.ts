import { describe, expect, it } from "vitest";
import { homeState } from "./Today";

describe("homeState", () => {
  it("教材还没拉完是 loading", () => {
    expect(homeState(null, null, 0, 10)).toBe("loading");
  });

  it("教材加载失败（空数组）是 failed，且优先于学完判断", () => {
    expect(homeState(0, null, 0, 10)).toBe("failed");
    expect(homeState(0, 0, 10, 10)).toBe("failed");
  });

  it("今天目标完成且没有可学的词是 done", () => {
    expect(homeState(8, 0, 10, 10)).toBe("done");
    expect(homeState(8, 0, 12, 10)).toBe("done");
  });

  it("没到目标但已经没词可学是 all-learned", () => {
    expect(homeState(8, 0, 3, 10)).toBe("all-learned");
    expect(homeState(8, 0, 0, 5)).toBe("all-learned");
  });

  it("还有词可学就是 ready，哪怕今天目标已完成", () => {
    expect(homeState(8, 5, 10, 10)).toBe("ready");
    expect(homeState(8, 3, 0, 10)).toBe("ready");
  });

  it("教材到位但计划还没算出来时不算学完", () => {
    // Today 里 books 非空时 plan 同步算好，此分支只是防御
    expect(homeState(8, null, 10, 10)).toBe("ready");
  });

  it("有未结算的会话时即使计划为空也保持 ready，别把继续学习禁掉", () => {
    expect(homeState(8, 0, 10, 10, true)).toBe("ready");
    expect(homeState(8, 0, 3, 10, true)).toBe("ready");
  });

  it("教材加载失败优先于会话状态", () => {
    expect(homeState(0, 0, 10, 10, true)).toBe("failed");
  });
});
