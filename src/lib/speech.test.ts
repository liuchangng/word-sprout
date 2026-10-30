import { describe, expect, it } from "vitest";
import { audioSlug, audioUrl, pickVoice, spokenText, ttsUrl } from "./speech";

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

describe("ttsUrl", () => {
  it("按口音选英式或美式", () => {
    expect(ttsUrl("name", "uk")).toContain("type=1");
    expect(ttsUrl("name", "us")).toContain("type=2");
  });

  it("对文本做 URL 编码", () => {
    expect(ttsUrl("have a look", "uk")).toContain("audio=have%20a%20look");
  });
});

describe("audioSlug", () => {
  it("转成小写连字符形式", () => {
    expect(audioSlug("PE")).toBe("pe");
    expect(audioSlug("Jinggangshan Revolution Museum")).toBe("jinggangshan-revolution-museum");
    expect(audioSlug("have … class")).toBe("have-class");
    expect(audioSlug("a.m.")).toBe("a-m");
  });
});

describe("audioUrl", () => {
  it("拼出本地音频路径", () => {
    expect(audioUrl("PE", "uk")).toBe("/audio/pe-uk.mp3");
    expect(audioUrl("name", "us")).toBe("/audio/name-us.mp3");
  });
});
