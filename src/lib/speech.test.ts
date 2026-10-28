import { describe, expect, it } from "vitest";
import { pickVoice } from "./speech";

const voice = (lang: string, name: string) => ({ lang, name }) as SpeechSynthesisVoice;

describe("pickVoice", () => {
  it("优先完全匹配口音", () => {
    const v = pickVoice([voice("en-US", "A"), voice("en-GB", "B")], "uk");
    expect(v?.name).toBe("B");
  });

  it("没有完全匹配时回退任意英语", () => {
    const v = pickVoice([voice("en-AU", "C")], "uk");
    expect(v?.name).toBe("C");
  });

  it("没有英语语音返回 null", () => {
    expect(pickVoice([voice("zh-CN", "D")], "us")).toBeNull();
  });
});
