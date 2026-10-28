import { useEffect, useRef, type ReactNode } from "react";

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 打开时锁滚动并聚焦关闭按钮，关闭/卸载时还原焦点与滚动
  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      lastFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="sheet-mask" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
