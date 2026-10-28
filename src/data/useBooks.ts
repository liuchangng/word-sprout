import { useEffect, useState } from "react";
import { catalog, loadBook } from "./catalog";
import type { Book } from "./types";

// 模块级缓存：8 册全书只在首次进入首页时拉一次，之后跨页面复用
let all: Book[] | null = null;

export function useAllBooks(): Book[] | null {
  const [books, setBooks] = useState<Book[] | null>(all);
  useEffect(() => {
    if (all) return;
    let alive = true;
    Promise.all(catalog.bookIds.map(loadBook))
      .then((list) => {
        all = list;
        if (alive) setBooks(list);
      })
      .catch(() => {
        // 教材 chunk 拉取失败时回到空态，别把 rejection 留给全局
        if (alive) setBooks([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return books;
}
