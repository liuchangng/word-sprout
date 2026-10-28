export interface SpeakOptions {
  accent?: "uk" | "us";
  rate?: number;
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
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth.getVoices(), accent);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? (accent === "uk" ? "en-GB" : "en-US");
  utter.rate = rate;
  synth.cancel();
  synth.speak(utter);
  return true;
}
