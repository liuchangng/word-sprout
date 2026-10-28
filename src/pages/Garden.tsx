import type { BookId } from "../data/types";

// 占位：后续任务替换为花圃页，这里先保证 App 的 props 契约成立
export function Garden(_props: { book?: BookId }) {
  return <main className="app-shell">花圃</main>;
}
