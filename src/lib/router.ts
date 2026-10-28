import { useSyncExternalStore } from "react";
import type { BookId } from "../data/types";

export type Route =
  | { page: "today" }
  | { page: "garden"; book?: BookId }
  | { page: "learn" }
  | { page: "word"; id: string }
  | { page: "me" }
  | { page: "onboarding" };

const BOOKS = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];

export function parseHash(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const seg = path.split("/").filter(Boolean);
  if (seg[0] === "garden") {
    const b = params.get("book");
    return { page: "garden", book: b && BOOKS.includes(b) ? (b as BookId) : undefined };
  }
  if (seg[0] === "learn") return { page: "learn" };
  if (seg[0] === "word" && seg[1]) return { page: "word", id: decodeURIComponent(seg[1]) };
  if (seg[0] === "me") return { page: "me" };
  if (seg[0] === "onboarding") return { page: "onboarding" };
  return { page: "today" };
}

export function href(route: Route): string {
  if (route.page === "today") return "#/";
  if (route.page === "garden") return `#/garden${route.book ? `?book=${route.book}` : ""}`;
  if (route.page === "word") return `#/word/${encodeURIComponent(route.id)}`;
  return `#/${route.page}`;
}

let current = parseHash(typeof location === "undefined" ? "" : location.hash);
const subs = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    current = parseHash(location.hash);
    subs.forEach((f) => f());
  });
}

// 提到模块级：每次渲染新建箭头函数会让 React 每帧退订再订阅
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export const useRoute = () => useSyncExternalStore(subscribe, () => current, () => current);

export function go(route: Route, replace = false) {
  const h = href(route);
  if (replace) history.replaceState(null, "", h);
  else history.pushState(null, "", h);
  current = parseHash(h);
  subs.forEach((f) => f());
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

export const currentRoute = () => current;
