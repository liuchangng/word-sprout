import indexFile from "./index.json";
import type { Book, BookId, IndexFile, Unit, Word } from "./types";

const index = indexFile as IndexFile;

export const catalog = {
  bookIds: index.bookIds,
  words: index.words,
  byId: new Map<string, Word>(index.words.map((w) => [w.id, w])),
};

export const getWord = (id: string) => catalog.byId.get(id);

export function unitWords(unit: Unit, dict: Map<string, Word> = catalog.byId): Word[] {
  return unit.wordIds.map((id) => dict.get(id)).filter((w): w is Word => !!w);
}

const modules = import.meta.glob<{ default: Book }>("./books/*.json");
const cache = new Map<BookId, Book>();

export async function loadBook(id: BookId): Promise<Book> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loader = modules[`./books/${id}.json`];
  if (!loader) throw new Error(`未知教材 ${id}`);
  const mod = await loader();
  cache.set(id, mod.default);
  return mod.default;
}

/** 从指定册开始，按单元顺序取未学词，跨册继续。 */
export function nextWordIds(count: number, learned: Set<string>, startBook: BookId, books: Book[]): string[] {
  const out: string[] = [];
  if (count <= 0) return out;
  const start = books.findIndex((b) => b.id === startBook);
  const ordered = start < 0 ? books : [...books.slice(start), ...books.slice(0, start)];
  for (const book of ordered) {
    for (const unit of book.units) {
      for (const id of unit.wordIds) {
        if (learned.has(id) || out.includes(id)) continue;
        out.push(id);
        if (out.length >= count) return out;
      }
    }
  }
  return out;
}
