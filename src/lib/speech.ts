export interface SpeakOptions {
  accent?: "uk" | "us";
  rate?: number;
}

const ABBR_RE = /^[A-Z]{2,4}$/;
let pending: number | undefined;

/** 全大写缩写按字母逐个读，否则引擎可能把 PE 读成一个音。 */
export function spokenText(text: string): string {
  const t = text.trim();
  return ABBR_RE.test(t) ? t.split("").join(" ") : t;
}

export function pickVoice(voices: SpeechSynthesisVoice[], accent: "uk" | "us"): SpeechSynthesisVoice | null {
  const exact = accent === "uk" ? "en-GB" : "en-US";
  return (
    voices.find((v) => v.lang === exact) ??
    voices.find((v) => v.lang.replace("_", "-").startsWith(exact)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ??
    null
  );
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 朗读失败返回 false，调用方据此隐藏喇叭或提示。 */
export function speak(text: string, { accent = "uk", rate = 1 }: SpeakOptions = {}): boolean {
  if (!canSpeak() || !text) return false;
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(spokenText(text));
  const voice = pickVoice(synth.getVoices(), accent);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? (accent === "uk" ? "en-GB" : "en-US");
  utter.rate = rate;
  // cancel 是异步的，紧接着 speak 会被一起取消，表现为只读出第一个音
  synth.cancel();
  if (pending !== undefined) window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = undefined;
    synth.speak(utter);
  }, 100);
  return true;
}
