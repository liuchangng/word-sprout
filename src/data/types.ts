export type BookId = "3A" | "3B" | "4A" | "4B" | "5A" | "5B" | "6A" | "6B";
export type Edition = 2024 | 2013;
export type Term = "上" | "下";

export interface Word {
  id: string;
  text: string;
  ipa: string;
  zh: string;
  pos?: string;
  core: boolean;
  units: string[];
  emoji?: string;
  example?: { en: string; zh: string; src: "textbook" | "tatoeba" };
}

export interface Unit {
  id: string;
  no: number;
  title: string;
  titleZh: string;
  wordIds: string[];
}

export interface Book {
  id: BookId;
  grade: 3 | 4 | 5 | 6;
  term: Term;
  edition: Edition;
  units: Unit[];
}

export interface IndexFile {
  generatedAt: string;
  bookIds: BookId[];
  words: Word[];
}
