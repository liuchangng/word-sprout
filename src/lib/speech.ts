export interface SpeakOptions {
  accent?: "uk" | "us";
  rate?: number;
}

const ABBR_RE = /^[A-Z]{2,4}$/;

/** 全大写缩写按字母逐个读，否则引擎可能把 PE 读成一个音。 */
export function spokenText(text: string): string {
  const t = text.trim();
  return ABBR_RE.test(t) ? t.split("").join(" ") : t;
}

/** 有道发音接口，type 1 英式、2 美式，返回 mp3，国内可直连。 */
export function ttsUrl(text: string, accent: "uk" | "us"): string {
  const type = accent === "uk" ? 1 : 2;
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`;
}

/** 与 scripts/build_audio.py 的 slug 规则保持一致。 */
export function audioSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 预生成的本地音频，手机微信也能直接播。 */
export function audioUrl(text: string, accent: "uk" | "us"): string {
  return `${import.meta.env.BASE_URL}audio/${audioSlug(text)}-${accent}.mp3`;
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

/** 能播在线音频或有系统语音就返回 true，手机微信里通常只有前者。 */
export function canSpeak(): boolean {
  if (typeof window === "undefined") return false;
  return typeof Audio !== "undefined" || "speechSynthesis" in window;
}

let current: HTMLAudioElement | null = null;

/** 系统语音兜底，失败返回 false。 */
function speakLocal(text: string, accent: "uk" | "us", rate: number): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth.getVoices(), accent);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? (accent === "uk" ? "en-GB" : "en-US");
  utter.rate = rate;
  // cancel 是异步的，紧接着 speak 会被一起取消，表现为只读出第一个音
  synth.cancel();
  window.setTimeout(() => synth.speak(utter), 100);
  return true;
}

/** 播放一个音频地址，开始播放返回 true，加载失败返回 false。 */
function playUrl(url: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.preservesPitch = true;
    audio.playbackRate = rate;
    current = audio;
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    audio.onerror = () => finish(false);
    audio.play().then(() => finish(true)).catch(() => finish(false));
  });
}

/** 依次尝试本地音频、有道接口，都失败再用系统语音。 */
export function speak(text: string, { accent = "uk", rate = 1 }: SpeakOptions = {}): boolean {
  if (!text) return false;
  const spoken = spokenText(text);
  if (current) {
    current.pause();
    current = null;
  }
  if (typeof Audio === "undefined") return speakLocal(spoken, accent, rate);
  // 本地音频按原词命名（pe-uk.mp3），缩写拆字母只在合成和在线接口里用
  void (async () => {
    for (const url of [audioUrl(text, accent), ttsUrl(spoken, accent)]) {
      if (await playUrl(url, rate)) return;
    }
    speakLocal(spoken, accent, rate);
  })();
  return true;
}
