import { useSyncExternalStore } from "react";
import { APP_ID, SCHEMA_VERSION, STORAGE_KEY } from "../config";
import type { BookId } from "../data/types";
import type { CardState } from "./srs";
import { dayKey, emptyStats, type Stats } from "./stats";
import type { ActiveSession } from "./session";

export interface Settings {
  dailyGoal: 5 | 10 | 15 | 20;
  activeBook: BookId;
  accent: "uk" | "us";
  rate: number;
  motion: "system" | "off";
  onboarded: boolean;
}

export interface SaveFile {
  v: 1;
  createdAt: number;
  updatedAt: number;
  settings: Settings;
  cards: Record<string, CardState>;
  stats: Stats;
  session: ActiveSession | null;
}

export const defaultSettings: Settings = {
  dailyGoal: 10,
  activeBook: "3A",
  accent: "uk",
  rate: 0.8,
  motion: "system",
  onboarded: false,
};

export const emptySave = (): SaveFile => ({
  v: SCHEMA_VERSION,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  settings: { ...defaultSettings },
  cards: {},
  stats: emptyStats(),
  session: null,
});

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, lo = -Infinity, hi = Infinity) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

function validCard(v: unknown): v is CardState {
  return (
    isObj(v) &&
    num(v.due, 0) && num(v.s, 0) && num(v.d, 0, 11) && num(v.el, 0) && num(v.sd, 0) &&
    num(v.ls, 0) && num(v.reps, 0) && num(v.lapses, 0) &&
    [0, 1, 2, 3].includes(v.st as number) &&
    (v.last === undefined || num(v.last, 0)) &&
    num(v.seen, 0)
  );
}

const GOALS = [5, 10, 15, 20];
const BOOKS: BookId[] = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];

export function sanitizeSave(v: unknown): SaveFile {
  const out = emptySave();
  if (!isObj(v) || v.v !== 1) return out;
  const s = v.settings;
  if (isObj(s)) {
    if (GOALS.includes(s.dailyGoal as number)) out.settings.dailyGoal = s.dailyGoal as Settings["dailyGoal"];
    if (BOOKS.includes(s.activeBook as BookId)) out.settings.activeBook = s.activeBook as BookId;
    if (s.accent === "uk" || s.accent === "us") out.settings.accent = s.accent;
    if (num(s.rate, 0.6, 1.2)) out.settings.rate = s.rate as number;
    if (s.motion === "system" || s.motion === "off") out.settings.motion = s.motion;
    if (typeof s.onboarded === "boolean") out.settings.onboarded = s.onboarded;
  }
  if (isObj(v.cards)) {
    for (const [k, c] of Object.entries(v.cards)) if (validCard(c)) out.cards[k] = c;
  }
  const st = v.stats;
  if (isObj(st)) {
    if (isObj(st.days)) {
      for (const [k, d] of Object.entries(st.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(d)) continue;
        if (num(d.learned) && num(d.reviewed) && num(d.correct) && num(d.total))
          out.stats.days[k] = { learned: d.learned, reviewed: d.reviewed, correct: d.correct, total: d.total } as never;
      }
    }
    if (num(st.streak, 0, 100000)) out.stats.streak = st.streak as number;
    if (typeof st.lastDay === "string" || st.lastDay === null) out.stats.lastDay = st.lastDay as string | null;
  }
  if (num(v.createdAt, 0)) out.createdAt = v.createdAt as number;
  out.updatedAt = Date.now();
  return out;
}

/* ---------- 备份 ---------- */

export function serializeBackup(save: SaveFile): string {
  const { session: _session, ...rest } = save;
  return JSON.stringify({ app: APP_ID, version: SCHEMA_VERSION, exported: new Date().toISOString(), save: rest }, null, 1);
}

export function parseBackup(text: string): { ok: true; save: SaveFile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效 JSON" };
  }
  if (!isObj(data) || data.app !== APP_ID || data.version !== SCHEMA_VERSION || !isObj(data.save))
    return { ok: false, error: "这不是词芽的备份文件" };
  const save = sanitizeSave({ ...data.save, v: SCHEMA_VERSION });
  if (Object.keys(save.cards).length === 0 && Object.keys((data.save as Record<string, unknown>).cards ?? {}).length > 0)
    return { ok: false, error: "备份中的学习记录无法识别" };
  return { ok: true, save };
}

/* ---------- 存储与订阅 ---------- */

interface State {
  save: SaveFile;
  saveError: boolean;
}

// 浏览器拒绝持久化时，读取 localStorage getter 会抛 SecurityError，必须兜住，否则整个 SPA 白屏
let canStore = false;
try {
  canStore = typeof localStorage !== "undefined";
} catch {
  canStore = false;
}

function readStored(): SaveFile {
  if (!canStore) return emptySave();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeSave(JSON.parse(raw)) : emptySave();
  } catch {
    return emptySave();
  }
}

let state: State = { save: readStored(), saveError: false };
const listeners = new Set<() => void>();
let timer: number | undefined;
let dirty = false;

const emit = () => listeners.forEach((l) => l());

function flush() {
  if (typeof window !== "undefined") window.clearTimeout(timer);
  if (!dirty) return;
  dirty = false;
  let ok = true;
  if (canStore) {
    try {
      // session 只为当前标签页续做而写，读取时会被 sanitizeSave 主动丢弃（未评分会话不跨刷新）
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
    } catch {
      ok = false;
    }
  } else {
    ok = false;
  }
  if (ok === state.saveError) {
    state = { ...state, saveError: !ok };
    emit();
  }
}

function schedule() {
  dirty = true;
  if (typeof window !== "undefined") {
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, 250);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
}

export const actions = {
  update(fn: (save: SaveFile) => SaveFile) {
    state = { ...state, save: { ...fn(state.save), updatedAt: Date.now() } };
    emit();
    schedule();
  },
  settings(patch: Partial<Settings>) {
    actions.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  replace(save: SaveFile) {
    state = { ...state, save: sanitizeSave(save) };
    emit();
    dirty = true;
    flush();
  },
  reset() {
    // 只清学习进度，保留选册、目标、发音与动效设置，也避免重新走引导
    const { settings } = state.save;
    state = { ...state, save: { ...emptySave(), settings } };
    emit();
    dirty = true;
    flush();
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useSave = <T,>(select: (s: SaveFile) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => select(state.save),
    () => select(state.save),
  );

export const useSaveError = () => useSyncExternalStore(subscribe, () => state.saveError, () => false);

export const getSave = () => state.save;
export const getSaveError = () => state.saveError;
export { flush };

/** 当天是否已有学习记录，用于首页文案。 */
export const hasStudiedToday = (s: SaveFile) => (s.stats.days[dayKey()]?.learned ?? 0) > 0;
