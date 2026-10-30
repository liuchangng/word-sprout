import { describe, expect, it } from "vitest";
import { pickVoice, spokenText } from "./speech";

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

describe("spokenText", () => {
  it("缩写按字母逐个读", () => {
    expect(spokenText("PE")).toBe("P E");
    expect(spokenText("USA")).toBe("U S A");
    expect(spokenText("RSVP")).toBe("R S V P");
  });

  it("普通单词原样返回", () => {
    expect(spokenText("peach")).toBe("peach");
    expect(spokenText("PE class")).toBe("PE class");
    expect(spokenText("I")).toBe("I");
  });
});
