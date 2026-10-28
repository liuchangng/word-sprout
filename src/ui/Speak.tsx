import { useEffect, useRef, useState } from "react";
import { canSpeak, speak } from "../lib/speech";

export function Speak({ text, accent = "uk", rate = 1, size = 18 }: { text: string; accent?: "uk" | "us"; rate?: number; size?: number }) {
  const [on, setOn] = useState(false);
  // 保存高亮计时器，卸载或再次点击时清理，避免卸载后 setState
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (timer.current !== undefined) window.clearTimeout(timer.current);
  }, []);

  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className={`speak ${on ? "is-on" : ""}`}
      aria-label={`朗读 ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        // 朗读失败（不支持、空文本、synth 抛错）就不做高亮动画
        if (!speak(text, { accent, rate })) return;
        setOn(true);
        if (timer.current !== undefined) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          setOn(false);
        }, 600);
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M17 8a5 5 0 0 1 0 8" />
      </svg>
    </button>
  );
}
