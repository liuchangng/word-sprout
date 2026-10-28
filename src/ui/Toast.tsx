import { useEffect, useRef } from "react";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  // 只按 message 重置计时器：调用方常传内联 onDone，父组件重渲染不应延长 toast
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => done.current(), 2600);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!message) return null;
  return <div className="toast" role="status" aria-live="polite">{message}</div>;
}
