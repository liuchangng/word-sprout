# 词芽 Word Sprout 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可离线使用的 PEP 小学英语单词花园，覆盖 8 册教材，具备每日学习闭环、FSRS 复习与花园进度。

**Architecture:** Vite + React 19 单页应用，纯静态无后端。教材数据在构建期由 Python 抽取 PDF 附录、Node 归一化去重后生成 JSON。运行期由 `store` 统一管理 localStorage 状态，`session` 生成每日四步卡片会话，`garden` 从 FSRS 卡片实时推导植物阶段。

**Tech Stack:** React 19、TypeScript 5.9、Vite 6、ts-fsrs 5、Vitest 3、PyMuPDF 1.28

## Global Constraints

- Node >= 20，npm >= 10，Python >= 3.10 且安装 `pymupdf`。
- 运行时无后端、无账号、无网络请求，唯一可选网络能力是浏览器 Web Speech TTS。
- 本地存储单键 `word-sprout:v1`，schema 版本 `v: 1`。
- 8 册书 id 固定为 `3A 3B 4A 4B 5A 5B 6A 6B`；`edition` 只允许 `2024` 或 `2013`。
- 5B、6B 标记 `edition: 2013`，界面显示“旧版”徽标。
- 全部界面文案为简体中文，代码注释为中文，禁止使用 em dash。
- 触控目标不小于 44px，动效遵循 `prefers-reduced-motion`。
- 教材词表版权属人教版，数据文件不对外发布。
- 提交前缀：`feat:` `fix:` `docs:` `test:` `chore:` `refactor:`。

---

## 文件结构

```
word-sprout/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  .gitignore
  scripts/
    extract_appendix.py        PDF 抽取，输出原始文本
    parse-appendix.mjs         纯函数解析与合并，可单测
    parse-appendix.test.mjs
    build-curriculum.mjs       编排、补音标、补例句、写 JSON
    emoji-map.json             词到 OpenMoji 文件名
    overrides/ipa.json         人工音标覆盖
    .cache/                    raw.json、dictionaryapi.json、tatoeba.json（不入库）
  src/
    main.tsx
    App.tsx
    data/
      types.ts
      catalog.ts
      catalog.test.ts
      index.json
      books/*.json
    store/
      srs.ts  srs.test.ts
      store.ts  store.test.ts
      stats.ts  stats.test.ts
      garden.ts  garden.test.ts
      session.ts  session.test.ts
    lib/
      router.ts  router.test.ts
      speech.ts  speech.test.ts
      text.ts
    ui/
      Sprout.tsx  GardenBed.tsx  Ring.tsx
      Sheet.tsx  Toast.tsx  Speak.tsx  Nav.tsx
    pages/
      Today.tsx  Garden.tsx  Learn.tsx  Word.tsx  Me.tsx  Onboarding.tsx
    styles/
      app.css
```

职责边界：

- `scripts/*` 只处理教材数据，产出 JSON 后与运行时代码无耦合。
- `src/data/catalog.ts` 是唯一读取 JSON 的入口，页面不直接 import JSON。
- `src/store/*` 只含纯逻辑与状态，不引用 React 组件。
- `src/ui/*` 只负责展示与交互，不含业务规则。

---

### Task 1: 项目脚手架与设计 token

**Files:**
- Create: `word-sprout/package.json`
- Create: `word-sprout/tsconfig.json`
- Create: `word-sprout/vite.config.ts`
- Create: `word-sprout/index.html`
- Create: `word-sprout/.gitignore`
- Create: `word-sprout/src/main.tsx`
- Create: `word-sprout/src/App.tsx`
- Create: `word-sprout/src/styles/app.css`
- Create: `word-sprout/src/config.ts`

**Interfaces:**
- Consumes: 无
- Produces: `APP_NAME`、`STORAGE_KEY` 常量；全局 CSS 变量 `--paper --leaf --sky --sun --soil --ink`；可运行的 Vite 入口

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "word-sprout",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "data:extract": "python scripts/extract_appendix.py",
    "data:build": "node scripts/build-curriculum.mjs"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "ts-fsrs": "^5.4.2"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^4.7.0",
    "openmoji": "^17.0.0",
    "typescript": "~5.9.3",
    "vite": "^6.4.1",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: 写 vite.config.ts 与 index.html**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.SPROUT_BASE || "/",
  plugins: [react()],
  server: { port: 5189, strictPort: true },
  preview: { port: 5189, strictPort: true },
});
```

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#FDF8EE" />
    <title>词芽 Word Sprout</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 写 config.ts、main.tsx、App.tsx 占位**

```ts
// src/config.ts
export const APP_NAME = "词芽";
export const APP_NAME_EN = "Word Sprout";
export const STORAGE_KEY = "word-sprout:v1";
export const APP_ID = "word-sprout";
export const SCHEMA_VERSION = 1;
```

```tsx
// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```tsx
// src/App.tsx
export function App() {
  return <main className="app-shell">词芽</main>;
}
```

- [ ] **Step 5: 写设计 token**

```css
/* src/styles/app.css */
:root {
  --paper: #fdf8ee;
  --card: #fffcf6;
  --leaf: #4e9b5f;
  --leaf-soft: #e4f1e4;
  --sky: #7fb8dc;
  --sun: #f5c542;
  --soil: #a9744f;
  --ink: #3d3a34;
  --ink-soft: #7a736a;
  --line: #efe5d4;
  --radius: 24px;
  --shadow: 0 6px 18px rgba(120, 100, 70, 0.1);
  --font: "Nunito", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}

* { box-sizing: border-box; }

html, body, #root { height: 100%; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
}

button {
  font: inherit;
  color: inherit;
  border: 0;
  background: none;
  cursor: pointer;
  min-height: 44px;
}

button:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}

.app-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 20px 18px 96px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 6: 写 .gitignore 并安装依赖**

```
node_modules
dist
scripts/.cache
.DS_Store
*.local
```

Run: `npm install`

- [ ] **Step 7: 验证构建**

Run: `npm run build`
Expected: `tsc -b` 无错误，`vite build` 输出 `dist/`。

- [ ] **Step 8: 提交**

```bash
git add .
git commit -m "chore: scaffold vite react ts project"
```

---

### Task 2: PDF 附录抽取

**Files:**
- Create: `word-sprout/scripts/extract_appendix.py`
- Create: `word-sprout/scripts/.cache/`（运行时生成）

**Interfaces:**
- Consumes: `D:\QMDownload\*.pdf`
- Produces: `scripts/.cache/raw.json`，结构为
  `{ [bookId]: { file: string, pages: { n: number, text: string }[] } }`

- [ ] **Step 1: 写抽取脚本**

```python
"""从 PEP 教材 PDF 中抽取附录原始文本，不做结构化解析。"""
import glob
import json
import os
import re

import pymupdf

OUT = os.path.join(os.path.dirname(__file__), ".cache", "raw.json")
GRADE = {"三": 3, "四": 4, "五": 5, "六": 6}
STOP = ("Vocabulary", "词 汇 表", "Vocabulary and", "总词汇表")


def book_id(name: str) -> str | None:
    grade = next((v for k, v in GRADE.items() if k in name), None)
    if grade is None:
        return None
    if "上册" in name:
        return f"{grade}A"
    if "下册" in name:
        return f"{grade}B"
    return None


def extract(path: str) -> dict | None:
    doc = pymupdf.open(path)
    texts = [doc[i].get_text() for i in range(len(doc))]
    start = next((i for i, t in enumerate(texts) if "Words in each unit" in t), None)
    if start is None:
        return None
    end = len(texts)
    for i in range(start + 1, len(texts)):
        if any(s in texts[i] for s in STOP):
            end = i
            break
    pages = [{"n": i + 1, "text": texts[i]} for i in range(start, min(end, start + 40))]
    return {"file": os.path.basename(path), "pages": pages}


def main() -> None:
    books = {}
    for path in sorted(glob.glob(r"D:\QMDownload\*.pdf")):
        bid = book_id(os.path.basename(path))
        if not bid:
            continue
        data = extract(path)
        if data is None:
            print(f"[跳过] {bid} 未找到附录: {os.path.basename(path)}")
            continue
        books[bid] = data
        chars = sum(len(p["text"]) for p in data["pages"])
        print(f"[抽取] {bid} 页数 {len(data['pages'])} 字符 {chars}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(books, f, ensure_ascii=False, indent=1)
    print(f"[完成] 写入 {OUT}，共 {len(books)} 本")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 运行并核对 8 本齐全**

Run: `npm run data:extract`
Expected: 8 行 `[抽取]`，无 `[跳过]`，`[完成] ... 共 8 本`。

- [ ] **Step 3: 抽查原始文本**

打开 `scripts/.cache/raw.json`，确认 3A 页面包含 `Words in each unit` 之后的 `Unit 1` 与若干 `单词 /音标/ 中文 p.页码` 行。若某本页数明显偏少（少于 4 页），把 STOP 条件放宽后在脚本里只取到 `start + 40`。

---

### Task 3: 词表解析、去重与构建

**Files:**
- Create: `word-sprout/scripts/parse-appendix.mjs`
- Create: `word-sprout/scripts/parse-appendix.test.mjs`
- Create: `word-sprout/scripts/build-curriculum.mjs`
- Create: `word-sprout/scripts/emoji-map.json`
- Create: `word-sprout/scripts/overrides/ipa.json`
- Create: `word-sprout/src/data/types.ts`
- Create: `word-sprout/src/data/index.json`（生成）
- Create: `word-sprout/src/data/books/*.json`（生成）

**Interfaces:**
- Consumes: `scripts/.cache/raw.json`
- Produces:
  - `parseEntry(line): { core: boolean; text: string; ipa: string; zh: string; pos?: string } | null`
  - `parseAppendix(text): { no: number; title: string; entries: Entry[] }[]`
  - `normalizeId(text): string`
  - `mergeWords(books): Word[]`
  - `src/data/types.ts` 中的 `BookId`、`Word`、`Unit`、`Book`、`IndexFile`

- [ ] **Step 1: 写类型定义**

```ts
// src/data/types.ts
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
```

- [ ] **Step 2: 写失败测试**

```js
// scripts/parse-appendix.test.mjs
import { describe, expect, it } from "vitest";
import { mergeWords, normalizeId, parseAppendix, parseEntry } from "./parse-appendix.mjs";

const SAMPLE = `
Words in each unit
Unit 1 Making friends
hello /həˈləʊ/ 你好 p. 4
*hi /haɪ/ 嗨 p. 4
I’m /aɪm/ 我是 p. 5
Unit 2 Different families
mum /mʌm/ 妈妈 p. 12
dad /dæd/ n. 爸爸 p. 12
*grandma /ˈɡrænmɑː/ 奶奶；
*姥姥
p. 16
*grandfather /ˈɡrænfɑːðə(r)/
爷爷；姥爷
p. 16
Useful expressions
Good morning! 早上好！
`;

describe("parseEntry", () => {
  it("解析普通词条", () => {
    expect(parseEntry("hello /həˈləʊ/ 你好 p. 4")).toEqual({
      core: false, text: "hello", ipa: "həˈləʊ", zh: "你好", pos: undefined,
    });
  });

  it("解析带星标的课标词", () => {
    expect(parseEntry("*hi /haɪ/ 嗨 p. 4")?.core).toBe(true);
  });

  it("解析带词性的词条", () => {
    expect(parseEntry("dad /dæd/ n. 爸爸 p. 12")?.pos).toBe("n");
  });

  it("保留撇号短语", () => {
    expect(parseEntry("I’m /aɪm/ 我是 p. 5")?.text).toBe("I’m");
  });

  it("拒绝页码与标题行", () => {
    expect(parseEntry("12")).toBeNull();
    expect(parseEntry("Unit 1 Making friends")).toBeNull();
    expect(parseEntry("Good morning! 早上好！")).toBeNull();
  });
});

describe("parseAppendix", () => {
  it("按单元切分并在常用表达前停止", () => {
    const units = parseAppendix(SAMPLE);
    expect(units.map((u) => u.no)).toEqual([1, 2]);
    expect(units[0].title).toBe("Making friends");
    expect(units[0].entries).toHaveLength(3);
    expect(units[1].entries.map((e) => e.text)).toEqual(["mum", "dad", "grandma", "grandfather"]);
  });

  it("拼接跨行词条，保留全部中文义项", () => {
    const units = parseAppendix(SAMPLE);
    const words = Object.fromEntries(units[1].entries.map((e) => [e.text, e]));
    expect(words.grandma.zh).toBe("奶奶； 姥姥");
    expect(words.grandfather.zh).toBe("爷爷； 姥爷");
    expect(words.grandfather.ipa).toBe("ˈɡrænfɑːðə(r)");
  });
});

describe("normalizeId", () => {
  it("统一大小写、空格与撇号", () => {
    expect(normalizeId("  I’m   Fine ")).toBe("w:i'm fine");
  });
});

describe("mergeWords", () => {
  it("跨册同词合并并累积单元", () => {
    const words = mergeWords([
      { id: "3A", units: [{ no: 1, title: "", entries: [{ core: false, text: "apple", ipa: "ˈæpl", zh: "苹果" }] }] },
      { id: "4A", units: [{ no: 2, title: "", entries: [{ core: true, text: "Apple", ipa: "", zh: "", pos: undefined }] }] },
    ]);
    expect(words).toHaveLength(1);
    expect(words[0].units).toEqual(["3A-U1", "4A-U2"]);
    expect(words[0].core).toBe(true);
    expect(words[0].ipa).toBe("ˈæpl");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run scripts/parse-appendix.test.mjs`
Expected: FAIL，`Failed to resolve import "./parse-appendix.mjs"`。

- [ ] **Step 4: 实现解析与合并**

```js
// scripts/parse-appendix.mjs
const CJK = /[\u4e00-\u9fff]/;
const POS_RE = /\b(n|v|vt|vi|adj|adv|pron|prep|conj|num|art|int|aux|modal)\./gi;
const PAGE_RE = /\s*p\.\s*\d+\s*$/i;
const SKIP_RE = /^(Unit\b|Appendix\b|附录|注[:：]|Words in each unit|单\s*元\s*词\s*汇\s*表)/i;
const STOP_RE = /(Useful expressions|常用表达|Vocabulary|词\s*汇\s*表)/i;
const START_RE = /^(?:\*)?[A-Za-z]/;

/** 规范化词条 id：小写、压缩空格、统一撇号。 */
export function normalizeId(text) {
  return "w:" + text.toLowerCase().trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

/** 解析一行词条，无法识别返回 null。 */
export function parseEntry(line) {
  let s = String(line).trim();
  if (!s || SKIP_RE.test(s)) return null;
  const core = s.startsWith("*");
  if (core) s = s.slice(1).trim();
  s = s.replace(PAGE_RE, "").trim();
  const cut = s.search(CJK);
  if (cut < 1) return null;
  let left = s.slice(0, cut).trim();
  let zh = s.slice(cut).trim();
  const posMatch = left.match(POS_RE) || zh.match(POS_RE);
  const pos = posMatch ? posMatch[0].replace(".", "").toLowerCase() : undefined;
  left = left.replace(POS_RE, " ").trim();
  const ipaMatch = left.match(/\/([^/]+)\//);
  const ipa = ipaMatch ? ipaMatch[1].trim() : "";
  const text = left.replace(/\/[^/]*\//g, " ").replace(/\s+/g, " ").trim();
  zh = zh.replace(/\*/g, "").replace(POS_RE, " ").replace(/\s+/g, " ").trim();
  if (!text || !/[A-Za-z]/.test(text) || !zh) return null;
  return { core, text, ipa, zh, pos };
}

/** 按 Unit 切分附录正文，遇到常用表达或词汇表即停止。 */
export function parseAppendix(text) {
  const units = [];
  let cur = null;
  let buf = [];
  let stopped = false;

  const flush = () => {
    if (cur && buf.length > 0) {
      const entry = parseEntry(buf.join(" "));
      if (entry) cur.entries.push(entry);
    }
    buf = [];
  };

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^\d{1,3}$/.test(line)) continue;
    if (/^p\.\s*\d+$/i.test(line)) continue;
    if (/仅供个人学习使用/.test(line)) continue;
    if (STOP_RE.test(line)) { stopped = true; flush(); continue; }
    if (stopped) continue;
    const m = line.match(/^Unit\s+(\d+)\s*[:：]?\s*(.*)$/i);
    if (m) {
      flush();
      cur = { no: Number(m[1]), title: m[2].trim(), entries: [] };
      units.push(cur);
      continue;
    }
    if (!cur) continue;
    // 词条可能跨行：新词条以拉丁字母开头，纯中文续行并入上一条。
    if (START_RE.test(line) && buf.length > 0) flush();
    buf.push(line);
  }
  flush();
  return units.filter((u) => u.entries.length > 0);
}

/** 跨册合并同名词条，单元归属累积。 */
export function mergeWords(books) {
  const map = new Map();
  for (const book of books) {
    for (const unit of book.units) {
      const unitId = `${book.id}-U${unit.no}`;
      for (const e of unit.entries) {
        const id = normalizeId(e.text);
        const w = map.get(id) ?? { id, text: e.text, ipa: "", zh: "", pos: undefined, core: false, units: [] };
        if (!w.ipa && e.ipa) w.ipa = e.ipa;
        if (!w.zh && e.zh) w.zh = e.zh;
        if (!w.pos && e.pos) w.pos = e.pos;
        w.core = w.core || e.core;
        if (!w.units.includes(unitId)) w.units.push(unitId);
        map.set(id, w);
      }
    }
  }
  return [...map.values()].sort((a, b) => a.text.localeCompare(b.text, "en"));
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run scripts/parse-appendix.test.mjs`
Expected: 9 个用例全部 PASS。

- [ ] **Step 6: 写 emoji 映射与音标覆盖的初始文件**

```json
{
  "apple": "🍎",
  "banana": "🍌",
  "orange": "🍊",
  "grape": "🍇",
  "pear": "🍐",
  "peach": "🍑",
  "watermelon": "🍉",
  "strawberry": "🍓",
  "bread": "🍞",
  "cake": "🍰",
  "milk": "🥛",
  "water": "💧",
  "egg": "🥚",
  "rice": "🍚",
  "fish": "🐟",
  "cat": "🐱",
  "dog": "🐶",
  "bird": "🐦",
  "duck": "🦆",
  "pig": "🐷",
  "monkey": "🐵",
  "tiger": "🐯",
  "elephant": "🐘",
  "panda": "🐼",
  "rabbit": "🐰",
  "horse": "🐴",
  "cow": "🐮",
  "bear": "🐻",
  "lion": "🦁",
  "book": "📚",
  "pencil": "✏️",
  "ruler": "📏",
  "bag": "🎒",
  "pen": "🖊️",
  "crayon": "🖍️",
  "chair": "🪑",
  "door": "🚪",
  "window": "🪟",
  "ball": "⚽",
  "car": "🚗",
  "bus": "🚌",
  "bike": "🚲",
  "train": "🚆",
  "plane": "✈️",
  "ship": "🚢",
  "sun": "☀️",
  "moon": "🌙",
  "star": "⭐",
  "rain": "🌧️",
  "snow": "❄️",
  "tree": "🌳",
  "flower": "🌸",
  "grass": "🌿",
  "house": "🏠",
  "school": "🏫",
  "park": "🏞️",
  "hospital": "🏥",
  "library": "📚",
  "zoo": "🦁",
  "family": "👨‍👩‍👧",
  "mother": "👩",
  "father": "👨",
  "brother": "👦",
  "sister": "👧",
  "teacher": "🧑‍🏫",
  "doctor": "🧑‍⚕️",
  "farmer": "🧑‍🌾",
  "friend": "🤝",
  "happy": "😄",
  "sad": "😢",
  "angry": "😠",
  "tired": "😴",
  "hot": "🥵",
  "cold": "🥶",
  "run": "🏃",
  "jump": "🤸",
  "swim": "🏊",
  "sing": "🎤",
  "dance": "💃",
  "read": "📖",
  "write": "✍️",
  "draw": "🎨",
  "eat": "🍴",
  "drink": "🥤",
  "sleep": "😴",
  "walk": "🚶",
  "play": "🎮"
}
```

键是词条小写文本，值是 emoji 字符。构建脚本用 OpenMoji 的 `data/openmoji.json` 把字符换成 hexcode，再从 `node_modules/openmoji/color/svg/` 复制 SVG 到 `public/emoji/{slug}.svg`。

```json
{}
```

`scripts/overrides/ipa.json` 的键是规范化 id（如 `w:mum`），值是音标字符串。运行时先查覆盖文件，再查缓存与网络。

- [ ] **Step 7: 写构建编排脚本**

```js
// scripts/build-curriculum.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeWords, normalizeId, parseAppendix } from "./parse-appendix.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts", ".cache");
const OUT = path.join(ROOT, "src", "data");
const BOOKS = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];
const EDITION = { "3A": 2024, "3B": 2024, "4A": 2024, "4B": 2024, "5A": 2024, "5B": 2013, "6A": 2024, "6B": 2013 };
const TITLE_ZH = {
  "3A": "三年级上册", "3B": "三年级下册", "4A": "四年级上册", "4B": "四年级下册",
  "5A": "五年级上册", "5B": "五年级下册", "6A": "六年级上册", "6B": "六年级下册",
};
const UNIT_TITLE_ZH = {
  "3A-U1": "交朋友", "3A-U2": "不同的家庭", "3A-U3": "有趣的动物", "3A-U4": "我们身边的植物",
  "3A-U5": "缤纷的颜色", "3A-U6": "有用的数字",
};

const readJson = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback);
const writeJson = (p, v) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 1) + "\n", "utf8");
};

const ipaOverride = readJson(path.join(ROOT, "scripts", "overrides", "ipa.json"), {});
const emojiMap = readJson(path.join(ROOT, "scripts", "emoji-map.json"), {});
const openmoji = readJson(path.join(ROOT, "node_modules", "openmoji", "data", "openmoji.json"), []);
const noVs = (ch) => String(ch).replace(/\uFE0F/g, "");
const hexOf = new Map(openmoji.map((e) => [noVs(e.emoji), e.hexcode]));
const slugOf = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const EMOJI_OUT = path.join(ROOT, "public", "emoji");
const cache = readJson(path.join(CACHE, "enrich.json"), {});
const offline = process.argv.includes("--offline");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 联网补音标与例句，结果写入缓存，失败静默跳过。 */
async function enrich(word) {
  const key = normalizeId(word.text);
  if (cache[key]) return cache[key];
  if (offline) return null;
  const out = {};
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.text)}`);
    if (res.ok) {
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      const ipa = entry?.phonetic || entry?.phonetics?.find((p) => p.text)?.text || "";
      if (ipa) out.ipa = ipa.replace(/^\/|\/$/g, "");
    }
  } catch {
    /* 网络不可用时保留空音标 */
  }
  await sleep(250);
  cache[key] = out;
  writeJson(path.join(CACHE, "enrich.json"), cache);
  return out;
}

function collectUnitTitles(parsed) {
  const map = {};
  for (const [id, units] of Object.entries(parsed)) {
    for (const u of units) map[`${id}-U${u.no}`] = u.title;
  }
  return map;
}

async function main() {
  const raw = readJson(path.join(CACHE, "raw.json"), null);
  if (!raw) throw new Error("缺少 scripts/.cache/raw.json，请先运行 npm run data:extract");

  const parsed = {};
  const books = [];
  for (const id of BOOKS) {
    const pages = raw[id]?.pages;
    if (!pages) throw new Error(`raw.json 缺少 ${id}`);
    const units = parseAppendix(pages.map((p) => p.text).join("\n"));
    parsed[id] = units;
    books.push({ id, units });
  }

  const words = mergeWords(books);
  const unitTitles = collectUnitTitles(parsed);

  for (const w of words) {
    // 从 OpenMoji 包复制命中的图标，未命中时保留首字母回退。
    const ch = emojiMap[w.text.toLowerCase()];
    const hex = ch ? hexOf.get(noVs(ch)) : undefined;
    const src = hex ? path.join(ROOT, "node_modules", "openmoji", "color", "svg", `${hex}.svg`) : null;
    if (src && fs.existsSync(src)) {
      const slug = slugOf(w.text);
      fs.mkdirSync(EMOJI_OUT, { recursive: true });
      fs.copyFileSync(src, path.join(EMOJI_OUT, `${slug}.svg`));
      w.emoji = slug;
    }
    const override = ipaOverride[w.id];
    if (override) w.ipa = override;
    else if (!w.ipa || /[\uE000-\uF8FF]/.test(w.ipa)) {
      const extra = await enrich(w);
      if (extra?.ipa) w.ipa = extra.ipa;
      else w.ipa = "";
    }
  }

  let missingIpa = 0;
  let missingEmoji = 0;
  let crossBook = 0;
  for (const w of words) {
    if (!w.ipa) missingIpa++;
    if (!w.emoji) missingEmoji++;
    if (new Set(w.units.map((u) => u.split("-")[0])).size > 1) crossBook++;
  }

  const byId = new Map(words.map((w) => [w.id, w]));
  for (const id of BOOKS) {
    const units = parsed[id].map((u) => {
      const uid = `${id}-U${u.no}`;
      return {
        id: uid,
        no: u.no,
        title: u.title || `Unit ${u.no}`,
        titleZh: UNIT_TITLE_ZH[uid] || u.title || "",
        wordIds: u.entries.map((e) => normalizeId(e.text)).filter((v, i, a) => a.indexOf(v) === i),
      };
    });
    const book = {
      id,
      grade: Number(id[0]),
      term: id.endsWith("A") ? "上" : "下",
      edition: EDITION[id],
      units,
    };
    writeJson(path.join(OUT, "books", `${id}.json`), book);
  }

  writeJson(path.join(OUT, "index.json"), {
    generatedAt: new Date().toISOString(),
    bookIds: BOOKS,
    words,
  });

  console.log(`[完成] 词条 ${words.length} 个，跨册重复 ${crossBook} 个`);
  console.log(`[统计] 缺音标 ${missingIpa}，缺图 ${missingEmoji}`);
  console.log(`[统计] 单元 ${books.reduce((n, b) => n + b.units.length, 0)} 个`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 8: 运行构建并核对统计**

Run: `npm run data:build -- --offline`
Expected: 输出词条数在 820 到 860 之间，单元数 46，缺图数允许大于 0，缺音标数应小于 60（5B/6B 旧版音标可能需要联网补）。

Run: `npm run data:build`
Expected: 联网补齐后缺音标数下降，`src/data/index.json` 与 8 个 `books/*.json` 生成。

- [ ] **Step 9: 抽查数据**

Run: `node -e "const d=require('./src/data/index.json'); console.log(d.words.length, d.words.filter(w=>w.units.length>1).slice(0,5))"`
Expected: 打印词数与若干跨册词，能人工确认识义与单元归属正确。

- [ ] **Step 10: 提交**

```bash
git add scripts src/data
git commit -m "feat: build pep curriculum dataset from pdf appendix"
```

---

### Task 4: 教材数据访问层

**Files:**
- Create: `word-sprout/src/data/catalog.ts`
- Create: `word-sprout/src/data/catalog.test.ts`

**Interfaces:**
- Consumes: `src/data/index.json`、`src/data/books/*.json`
- Produces:
  - `catalog: { words: Word[]; byId: Map<string, Word>; bookIds: BookId[] }`
  - `getWord(id: string): Word | undefined`
  - `loadBook(id: BookId): Promise<Book>`
  - `useBook(id: BookId): Book | null`
  - `nextWordIds(count: number, learned: Set<string>, startBook: BookId, books: Book[]): string[]`

- [ ] **Step 1: 写失败测试**

```ts
// src/data/catalog.test.ts
import { describe, expect, it } from "vitest";
import { catalog, getWord, nextWordIds, unitWords } from "./catalog";
import type { Book, BookId } from "./types";

const fakeBook = (id: BookId, units: string[][]): Book => ({
  id,
  grade: Number(id[0]) as 3 | 4 | 5 | 6,
  term: id.endsWith("A") ? "上" : "下",
  edition: 2024,
  units: units.map((ids, i) => ({
    id: `${id}-U${i + 1}`,
    no: i + 1,
    title: `Unit ${i + 1}`,
    titleZh: "",
    wordIds: ids,
  })),
});

describe("catalog", () => {
  it("包含 8 本书与去重后的词条", () => {
    expect(catalog.bookIds).toHaveLength(8);
    expect(catalog.words.length).toBeGreaterThan(800);
    expect(new Set(catalog.words.map((w) => w.id)).size).toBe(catalog.words.length);
  });

  it("按 id 取词", () => {
    const w = catalog.words[0];
    expect(getWord(w.id)).toBe(w);
    expect(getWord("w:__missing__")).toBeUndefined();
  });
});

describe("unitWords", () => {
  it("按单元顺序返回词条", () => {
    const book = fakeBook("3A", [["w:b", "w:a"]]);
    const words = unitWords(book.units[0], new Map([
      ["w:a", { id: "w:a", text: "a", ipa: "", zh: "甲", core: false, units: [] }],
      ["w:b", { id: "w:b", text: "b", ipa: "", zh: "乙", core: false, units: [] }],
    ]));
    expect(words.map((w) => w.id)).toEqual(["w:b", "w:a"]);
  });
});

describe("nextWordIds", () => {
  const books = [
    fakeBook("3A", [["w:a", "w:b"], ["w:c"]]),
    fakeBook("3B", [["w:d"]]),
  ];

  it("按册与单元顺序取未学词", () => {
    expect(nextWordIds(2, new Set(["w:a"]), "3A", books)).toEqual(["w:b", "w:c"]);
  });

  it("当前册不足时进入下一册", () => {
    expect(nextWordIds(3, new Set(["w:a", "w:b", "w:c"]), "3A", books)).toEqual(["w:d"]);
  });

  it("全部学完返回空数组", () => {
    expect(nextWordIds(5, new Set(["w:a", "w:b", "w:c", "w:d"]), "3A", books)).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/data/catalog.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现数据访问层**

```ts
// src/data/catalog.ts
import { useEffect, useState } from "react";
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

export function useBook(id: BookId): Book | null {
  const [book, setBook] = useState<Book | null>(cache.get(id) ?? null);
  useEffect(() => {
    let alive = true;
    if (cache.has(id)) {
      setBook(cache.get(id)!);
      return;
    }
    loadBook(id).then((b) => alive && setBook(b));
    return () => {
      alive = false;
    };
  }, [id]);
  return book;
}

/** 从指定册开始，按单元顺序取未学词，跨册继续。 */
export function nextWordIds(count: number, learned: Set<string>, startBook: BookId, books: Book[]): string[] {
  const out: string[] = [];
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/data/catalog.test.ts`
Expected: 7 个用例 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/data
git commit -m "feat: add curriculum catalog access layer"
```

---

### Task 5: FSRS 排期模块

**Files:**
- Create: `word-sprout/src/store/srs.ts`
- Create: `word-sprout/src/store/srs.test.ts`

**Interfaces:**
- Consumes: `ts-fsrs`
- Produces:
  - `CardState` 序列化结构
  - `review(prev, grade, now, retention?): CardState`
  - `preview(prev, now, retention?): Record<Grade, number>`
  - `isMastered(c?): boolean`
  - `MASTERED_STABILITY = 21`
  - `formatInterval(ms): string`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/srs.test.ts
import { describe, expect, it } from "vitest";
import { formatInterval, MASTERED_STABILITY, Rating, review, isMastered } from "./srs";

const DAY = 86400000;
const now = Date.UTC(2026, 0, 1);

describe("review", () => {
  it("首次 Good 产生可复习的卡片", () => {
    const c = review(undefined, Rating.Good, now);
    expect(c.reps).toBe(1);
    expect(c.seen).toBe(now);
    expect(c.due).toBeGreaterThan(now);
  });

  it("再次 Good 提高稳定度", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Good, now + DAY);
    expect(c2.s).toBeGreaterThan(c1.s);
  });

  it("Again 降低稳定度", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Again, now + DAY);
    expect(c2.s).toBeLessThan(c1.s);
  });

  it("seen 只记录第一次", () => {
    const c1 = review(undefined, Rating.Good, now);
    const c2 = review(c1, Rating.Good, now + DAY);
    expect(c2.seen).toBe(now);
  });
});

describe("isMastered", () => {
  it("稳定度达到阈值且有复习记录才算掌握", () => {
    expect(isMastered(undefined)).toBe(false);
    expect(isMastered({ due: now, s: MASTERED_STABILITY, d: 5, el: 0, sd: 1, ls: 0, reps: 3, lapses: 0, st: 2, seen: now })).toBe(true);
    expect(isMastered({ due: now, s: MASTERED_STABILITY - 1, d: 5, el: 0, sd: 1, ls: 0, reps: 3, lapses: 0, st: 2, seen: now })).toBe(false);
  });
});

describe("formatInterval", () => {
  it("按量级返回中文", () => {
    expect(formatInterval(30 * 1000)).toBe("<1分");
    expect(formatInterval(5 * 60000)).toBe("5分");
    expect(formatInterval(3 * DAY)).toBe("3天");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/srs.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 srs.ts**

从 `word-atlas/src/store/srs.ts` 复制，只保留本项目要用的部分，删掉 `retrievability`。

```ts
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

/** 序列化后的 FSRS 卡片，日期用毫秒时间戳。 */
export interface CardState {
  due: number;
  s: number;
  d: number;
  el: number;
  sd: number;
  ls: number;
  reps: number;
  lapses: number;
  st: 0 | 1 | 2 | 3;
  last?: number;
  seen: number;
}

export { Rating };
export type { Grade };

const schedulers = new Map<number, ReturnType<typeof fsrs>>();

function scheduler(retention: number) {
  let s = schedulers.get(retention);
  if (!s) {
    s = fsrs({
      request_retention: retention,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ["1m", "10m"],
      relearning_steps: ["10m"],
    });
    schedulers.set(retention, s);
  }
  return s;
}

const toCard = (c: CardState): Card => ({
  due: new Date(c.due),
  stability: c.s,
  difficulty: c.d,
  elapsed_days: c.el,
  scheduled_days: c.sd,
  learning_steps: c.ls,
  reps: c.reps,
  lapses: c.lapses,
  state: c.st as State,
  last_review: c.last ? new Date(c.last) : undefined,
});

const fromCard = (c: Card, seen: number): CardState => ({
  due: c.due.getTime(),
  s: c.stability,
  d: c.difficulty,
  el: c.elapsed_days,
  sd: c.scheduled_days,
  ls: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  st: c.state as CardState["st"],
  last: c.last_review?.getTime(),
  seen,
});

export function review(prev: CardState | undefined, grade: Grade, now: number, retention = 0.9): CardState {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const next = scheduler(retention).next(card, new Date(now), grade).card;
  return fromCard(next, prev?.seen ?? now);
}

export function preview(prev: CardState | undefined, now: number, retention = 0.9): Record<Grade, number> {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const p = scheduler(retention).repeat(card, new Date(now));
  return {
    [Rating.Again]: p[Rating.Again].card.due.getTime() - now,
    [Rating.Hard]: p[Rating.Hard].card.due.getTime() - now,
    [Rating.Good]: p[Rating.Good].card.due.getTime() - now,
    [Rating.Easy]: p[Rating.Easy].card.due.getTime() - now,
  } as Record<Grade, number>;
}

export const MASTERED_STABILITY = 21;
export const isMastered = (c?: CardState) => !!c && c.st === 2 && c.s >= MASTERED_STABILITY;

export function formatInterval(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1分";
  if (m < 60) return `${m}分`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}小时`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}天`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}个月`;
  return `${(d / 365).toFixed(1)}年`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/srs.test.ts`
Expected: 8 个用例 PASS。若 `c2.s < c1.s` 因 FSRS 参数波动失败，改为断言 `c2.lapses > c1.lapses`。

- [ ] **Step 5: 提交**

```bash
git add src/store/srs.ts src/store/srs.test.ts
git commit -m "feat: add fsrs scheduling wrapper"
```

---

### Task 6: 每日统计与连续天数

**Files:**
- Create: `word-sprout/src/store/stats.ts`
- Create: `word-sprout/src/store/stats.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `DayStat { learned; reviewed; correct; total }`
  - `Stats { days; streak; lastDay }`
  - `dayKey(d?): string`
  - `bumpDay(stats, patch, now?): Stats`
  - `reconcileStreak(stats, now?): Stats`
  - `learnedToday(stats, now?): number`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/stats.test.ts
import { describe, expect, it } from "vitest";
import { bumpDay, dayKey, emptyStats, learnedToday, reconcileStreak } from "./stats";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 10, 0, 0);

describe("dayKey", () => {
  it("使用本地日期并补零", () => {
    expect(dayKey(d(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("bumpDay", () => {
  it("同日多次累加不重复计天", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 3, reviewed: 3, correct: 2, total: 3 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 2, reviewed: 1, correct: 1, total: 1 }, d(2026, 3, 1));
    expect(s.days["2026-03-01"]).toEqual({ learned: 5, reviewed: 4, correct: 3, total: 4 });
    expect(s.streak).toBe(1);
  });

  it("连续第二天累加连击", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 2));
    expect(s.streak).toBe(2);
  });

  it("断档后重新从 1 开始", () => {
    let s = emptyStats();
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 1));
    s = bumpDay(s, { learned: 1 }, d(2026, 3, 4));
    expect(s.streak).toBe(1);
  });

  it("只有时间没有学习不计入连击", () => {
    const s = bumpDay(emptyStats(), { total: 1 }, d(2026, 3, 1));
    expect(s.streak).toBe(0);
    expect(s.lastDay).toBeNull();
  });
});

describe("reconcileStreak", () => {
  it("昨天学过保持连击", () => {
    const s = reconcileStreak({ days: {}, streak: 4, lastDay: "2026-03-01" }, d(2026, 3, 2));
    expect(s.streak).toBe(4);
  });

  it("隔天未学归零", () => {
    const s = reconcileStreak({ days: {}, streak: 4, lastDay: "2026-03-01" }, d(2026, 3, 3));
    expect(s.streak).toBe(0);
  });
});

describe("learnedToday", () => {
  it("读取当天新学数量", () => {
    const s = bumpDay(emptyStats(), { learned: 7 }, d(2026, 3, 1));
    expect(learnedToday(s, d(2026, 3, 1))).toBe(7);
    expect(learnedToday(s, d(2026, 3, 2))).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/stats.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 stats.ts**

```ts
// src/store/stats.ts
export interface DayStat {
  learned: number;
  reviewed: number;
  correct: number;
  total: number;
}

export interface Stats {
  days: Record<string, DayStat>;
  streak: number;
  lastDay: string | null;
}

export const emptyStats = (): Stats => ({ days: {}, streak: 0, lastDay: null });

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** 累加当天数据，并在有学习行为时维护连击。 */
export function bumpDay(stats: Stats, patch: Partial<DayStat>, now = new Date()): Stats {
  const k = dayKey(now);
  const base = stats.days[k] ?? { learned: 0, reviewed: 0, correct: 0, total: 0 };
  const day: DayStat = {
    learned: base.learned + (patch.learned ?? 0),
    reviewed: base.reviewed + (patch.reviewed ?? 0),
    correct: base.correct + (patch.correct ?? 0),
    total: base.total + (patch.total ?? 0),
  };
  const active = day.learned + day.reviewed > 0;
  let streak = stats.streak;
  let lastDay = stats.lastDay;
  if (active && lastDay !== k) {
    streak = lastDay && shiftKey(lastDay, 1) === k ? streak + 1 : 1;
    lastDay = k;
  }
  return { days: { ...stats.days, [k]: day }, streak, lastDay };
}

/** 打开应用时校正连击，昨天之后没学则归零。 */
export function reconcileStreak(stats: Stats, now = new Date()): Stats {
  if (!stats.lastDay) return stats;
  const today = dayKey(now);
  if (stats.lastDay === today || shiftKey(stats.lastDay, 1) === today) return stats;
  return { ...stats, streak: 0 };
}

export const learnedToday = (stats: Stats, now = new Date()) => stats.days[dayKey(now)]?.learned ?? 0;
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/stats.test.ts`
Expected: 8 个用例 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/store/stats.ts src/store/stats.test.ts
git commit -m "feat: add daily stats and streak tracking"
```

---

### Task 7: 花园阶段推导

**Files:**
- Create: `word-sprout/src/store/garden.ts`
- Create: `word-sprout/src/store/garden.test.ts`

**Interfaces:**
- Consumes: `CardState`、`Unit`
- Produces:
  - `Stage = 0 | 1 | 2 | 3`
  - `STAGE_LABEL: readonly string[]`
  - `stageOf(card?): Stage`
  - `progressOf(wordIds, cards): Progress`
  - `Progress { total; sprouted; leafed; bloomed; ratio }`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/garden.test.ts
import { describe, expect, it } from "vitest";
import { progressOf, stageOf } from "./garden";
import type { CardState } from "./srs";

const card = (patch: Partial<CardState>): CardState => ({
  due: 0, s: 0, d: 5, el: 0, sd: 0, ls: 0, reps: 0, lapses: 0, st: 1, seen: 0, ...patch,
});

describe("stageOf", () => {
  it("没有卡片是种子", () => {
    expect(stageOf(undefined)).toBe(0);
    expect(stageOf(card({ reps: 0 }))).toBe(0);
  });

  it("学过一次是嫩芽", () => {
    expect(stageOf(card({ reps: 1 }))).toBe(1);
    expect(stageOf(card({ reps: 2, sd: 0 }))).toBe(1);
  });

  it("复习过且间隔至少一天是叶", () => {
    expect(stageOf(card({ reps: 2, sd: 1, s: 3 }))).toBe(2);
  });

  it("稳定度达到 21 天是花", () => {
    expect(stageOf(card({ reps: 3, sd: 5, s: 21 }))).toBe(3);
    expect(stageOf(card({ reps: 3, sd: 5, s: 20.9 }))).toBe(2);
  });
});

describe("progressOf", () => {
  const cards: Record<string, CardState> = {
    a: card({ reps: 3, sd: 5, s: 25 }),
    b: card({ reps: 2, sd: 1, s: 4 }),
    c: card({ reps: 1 }),
  };

  it("统计各阶段数量", () => {
    const p = progressOf(["a", "b", "c", "d"], cards);
    expect(p).toEqual({ total: 4, sprouted: 3, leafed: 2, bloomed: 1, ratio: 0.25 });
  });

  it("空单元不除零", () => {
    expect(progressOf([], cards).ratio).toBe(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/garden.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 garden.ts**

```ts
// src/store/garden.ts
import type { CardState } from "./srs";

export type Stage = 0 | 1 | 2 | 3;
export const STAGE_LABEL = ["种子", "嫩芽", "叶", "花"] as const;

/** 由 FSRS 卡片推导植物阶段，不额外存状态。 */
export function stageOf(card?: CardState): Stage {
  if (!card || card.reps === 0) return 0;
  if (card.reps >= 2 && card.sd >= 1) return card.s >= 21 ? 3 : 2;
  return 1;
}

export interface Progress {
  total: number;
  sprouted: number;
  leafed: number;
  bloomed: number;
  ratio: number;
}

export function progressOf(wordIds: string[], cards: Record<string, CardState>): Progress {
  let sprouted = 0;
  let leafed = 0;
  let bloomed = 0;
  for (const id of wordIds) {
    const stage = stageOf(cards[id]);
    if (stage >= 1) sprouted++;
    if (stage >= 2) leafed++;
    if (stage === 3) bloomed++;
  }
  const total = wordIds.length;
  return { total, sprouted, leafed, bloomed, ratio: total ? bloomed / total : 0 };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/garden.test.ts`
Expected: 6 个用例 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/store/garden.ts src/store/garden.test.ts
git commit -m "feat: derive plant stages from fsrs cards"
```

---

### Task 8: 本地状态存储与备份

**Files:**
- Create: `word-sprout/src/store/store.ts`
- Create: `word-sprout/src/store/store.test.ts`
- Create: `word-sprout/src/store/session.ts`（仅类型，Task 9 补实现）

**Interfaces:**
- Consumes: `CardState`、`Stats`、`ActiveSession`（类型）
- Produces:
  - `Settings`、`SaveFile`
  - `defaultSettings`、`emptySave()`
  - `sanitizeSave(v): SaveFile`
  - `serializeBackup(save): string`
  - `parseBackup(text): { ok: true; save: SaveFile } | { ok: false; error: string }`
  - `useSave<T>(select): T`
  - `actions.settings(patch)`、`actions.update(fn)`、`actions.replace(save)`、`actions.reset()`
  - `flush()`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/store.test.ts
import { describe, expect, it } from "vitest";
import { defaultSettings, emptySave, parseBackup, sanitizeSave, serializeBackup } from "./store";

const validCard = {
  due: 1, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1, seen: 1,
};

describe("emptySave", () => {
  it("默认 10 词、三上、未引导", () => {
    const s = emptySave();
    expect(s.settings.dailyGoal).toBe(10);
    expect(s.settings.activeBook).toBe("3A");
    expect(s.settings.onboarded).toBe(false);
    expect(s.cards).toEqual({});
    expect(s.stats.streak).toBe(0);
  });
});

describe("sanitizeSave", () => {
  it("丢弃非法卡片，保留合法卡片", () => {
    const s = sanitizeSave({ v: 1, cards: { ok: validCard, bad: { due: "x" } } });
    expect(Object.keys(s.cards)).toEqual(["ok"]);
  });

  it("修正越界设置", () => {
    const s = sanitizeSave({
      v: 1,
      settings: { dailyGoal: 99, activeBook: "9Z", accent: "xx", rate: 5, motion: "off" },
    });
    expect(s.settings.dailyGoal).toBe(10);
    expect(s.settings.activeBook).toBe("3A");
    expect(s.settings.accent).toBe("uk");
    expect(s.settings.rate).toBe(1);
    expect(s.settings.motion).toBe("off");
  });

  it("版本不符时返回空存档", () => {
    expect(sanitizeSave({ v: 2, cards: { a: validCard } }).cards).toEqual({});
  });

  it("接受合法的统计与设置", () => {
    const s = sanitizeSave({
      v: 1,
      settings: { dailyGoal: 15, activeBook: "5B", accent: "us", rate: 0.9, onboarded: true },
      cards: { a: validCard },
      stats: { days: { "2026-03-01": { learned: 2, reviewed: 1, correct: 2, total: 3 } }, streak: 4, lastDay: "2026-03-01" },
    });
    expect(s.settings.dailyGoal).toBe(15);
    expect(s.settings.activeBook).toBe("5B");
    expect(s.stats.streak).toBe(4);
  });
});

describe("backup", () => {
  it("导出后能完整导入，且不包含进行中的会话", () => {
    const save = { ...emptySave(), cards: { a: validCard }, session: { id: "s1" } as never };
    const text = serializeBackup(save);
    expect(text).not.toContain('"session"');
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.save.cards.a.reps).toBe(1);
  });

  it("拒绝非 JSON", () => {
    expect(parseBackup("not json")).toEqual({ ok: false, error: "文件不是有效 JSON" });
  });

  it("拒绝其他应用的备份", () => {
    expect(parseBackup(JSON.stringify({ app: "word-atlas", version: 1 }))).toEqual({
      ok: false,
      error: "这不是词芽的备份文件",
    });
  });
});

describe("defaultSettings", () => {
  it("语速 1，口音英式", () => {
    expect(defaultSettings.rate).toBe(1);
    expect(defaultSettings.accent).toBe("uk");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/store.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 store.ts**

```ts
// src/store/store.ts
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
  rate: 1,
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
    if (num(s.rate, 0.7, 1.2)) out.settings.rate = s.rate;
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
    if (num(st.streak, 0, 100000)) out.stats.streak = st.streak;
    if (typeof st.lastDay === "string" || st.lastDay === null) out.stats.lastDay = st.lastDay as string | null;
  }
  if (num(v.createdAt, 0)) out.createdAt = v.createdAt;
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

const canStore = typeof localStorage !== "undefined";

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
    state = { ...state, save: emptySave() };
    emit();
    dirty = true;
    flush();
  },
};

export const useSave = <T,>(select: (s: SaveFile) => T): T =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state.save),
    () => select(state.save),
  );

export const getSave = () => state.save;
export const getSaveError = () => state.saveError;
export { flush };

/** 当天是否已有学习记录，用于首页文案。 */
export const hasStudiedToday = (s: SaveFile) => (s.stats.days[dayKey()]?.learned ?? 0) > 0;
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/store.test.ts`
Expected: 10 个用例 PASS。

- [ ] **Step 5: 提交**

```bash
git add src/store/store.ts src/store/store.test.ts
git commit -m "feat: add versioned local save with backup validation"
```

---

### Task 9: 每日计划与会话引擎

**Files:**
- Modify: `word-sprout/src/store/session.ts`（Task 8 已建类型）
- Create: `word-sprout/src/store/session.test.ts`

**Interfaces:**
- Consumes: `SaveFile`、`Book`、`catalog`、`nextWordIds`、`review`、`bumpDay`
- Produces:
  - `StepKind`、`Step`、`ActiveSession`
  - `Plan { due; fresh; total }`
  - `buildPlan(save, books, now?): Plan`
  - `buildSession(save, books, now?): ActiveSession`
  - `gradeForErrors(errors, selfHard): Grade`
  - `startSession(books)`、`answer(correct)`、`next()`、`finishWord(selfHard)`、`abortSession()`
  - `todayProgress(save, now?): { done: number; goal: number }`

- [ ] **Step 1: 写失败测试**

```ts
// src/store/session.test.ts
import { describe, expect, it } from "vitest";
import { catalog } from "../data/catalog";
import type { Book, BookId } from "../data/types";
import { Rating } from "./srs";
import { emptySave } from "./store";
import { buildPlan, buildSession, gradeForErrors, todayProgress } from "./session";

const book = (id: BookId, units: string[][]): Book => ({
  id,
  grade: Number(id[0]) as 3 | 4 | 5 | 6,
  term: id.endsWith("A") ? "上" : "下",
  edition: 2024,
  units: units.map((ids, i) => ({ id: `${id}-U${i + 1}`, no: i + 1, title: `Unit ${i + 1}`, titleZh: "", wordIds: ids })),
});

const ids = catalog.words.slice(0, 12).map((w) => w.id);
const books = [book("3A", [ids.slice(0, 6), ids.slice(6, 12)])];

describe("buildPlan", () => {
  it("新用户取满每日目标", () => {
    const plan = buildPlan(emptySave(), books);
    expect(plan.fresh).toHaveLength(10);
    expect(plan.due).toHaveLength(0);
  });

  it("到期复习不超过目标的 60%", () => {
    const save = emptySave();
    const now = Date.now();
    for (const id of ids) {
      save.cards[id] = { due: now - 1000, s: 1, d: 5, el: 0, sd: 0, ls: 0, reps: 1, lapses: 0, st: 1, seen: 0 };
    }
    expect(buildPlan(save, books, now).due).toHaveLength(6);
  });

  it("当天已学部分后不再补满", () => {
    const save = emptySave();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    save.stats.days[key] = { learned: 7, reviewed: 0, correct: 0, total: 0 };
    expect(buildPlan(save, books).fresh).toHaveLength(3);
  });

  it("全部学完返回空计划", () => {
    const save = emptySave();
    for (const id of ids) save.cards[id] = { due: Date.now() + 86400000, s: 5, d: 5, el: 0, sd: 1, ls: 0, reps: 2, lapses: 0, st: 2, seen: 0 };
    expect(buildPlan(save, books).fresh).toHaveLength(0);
  });
});

describe("buildSession", () => {
  it("每个词四步，顺序为听、选义、拼写、认读", () => {
    const s = buildSession(emptySave(), books);
    const first = s.steps.slice(0, 4).map((x) => x.kind);
    expect(first).toEqual(["listen", "meaning", "spell", "reveal"]);
    expect(s.steps).toHaveLength(s.newIds.length * 4);
  });

  it("选义题有四个互不相同的选项且包含正确答案", () => {
    const s = buildSession(emptySave(), books);
    const step = s.steps.find((x) => x.kind === "meaning")!;
    expect(step.options).toHaveLength(4);
    expect(new Set(step.options).size).toBe(4);
    expect(step.options).toContain(catalog.byId.get(step.wordId)!.zh);
  });
});

describe("gradeForErrors", () => {
  it("零错为 Good，一错为 Hard，两错为 Again", () => {
    expect(gradeForErrors(0, false)).toBe(Rating.Good);
    expect(gradeForErrors(1, false)).toBe(Rating.Hard);
    expect(gradeForErrors(2, false)).toBe(Rating.Again);
    expect(gradeForErrors(5, false)).toBe(Rating.Again);
  });

  it("自评有点难时最多 Hard", () => {
    expect(gradeForErrors(0, true)).toBe(Rating.Hard);
  });
});

describe("todayProgress", () => {
  it("没有记录时从 0 开始", () => {
    expect(todayProgress(emptySave())).toEqual({ done: 0, goal: 10 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/store/session.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 session.ts**

```ts
// src/store/session.ts
import { catalog, nextWordIds } from "../data/catalog";
import type { Book, Word } from "../data/types";
import { Rating, review, type Grade } from "./srs";
import { bumpDay, dayKey, learnedToday } from "./stats";
import { actions, type SaveFile } from "./store";

export type StepKind = "listen" | "meaning" | "spell" | "reveal";

export interface Step {
  wordId: string;
  kind: StepKind;
  options?: string[];
  retry?: boolean;
}

export interface ActiveSession {
  id: string;
  started: number;
  steps: Step[];
  index: number;
  graded: Record<string, Grade>;
  newIds: string[];
  reviewIds: string[];
  errors: Record<string, number>;
  pending?: { correct: boolean };
  finished?: number;
}

export interface Plan {
  due: string[];
  fresh: string[];
  total: number;
}

const wordOf = (id: string): Word | undefined => catalog.byId.get(id);

function optionSet(word: Word, pool: Word[], seed: number): string[] {
  const picks: string[] = [];
  const seen = new Set([word.zh]);
  for (let i = 0; i < pool.length * 2 && picks.length < 3; i++) {
    const w = pool[(seed + i * 13) % pool.length];
    if (!w || seen.has(w.zh)) continue;
    seen.add(w.zh);
    picks.push(w.zh);
  }
  const all = [word.zh, ...picks];
  const rotate = Math.abs(seed) % all.length;
  return [...all.slice(rotate), ...all.slice(0, rotate)];
}

/** 复习优先，最多占目标 60%，剩余补新词。 */
export function buildPlan(save: SaveFile, books: Book[], now = Date.now()): Plan {
  const cap = Math.ceil(save.settings.dailyGoal * 0.6);
  const due = Object.entries(save.cards)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id)
    .slice(0, cap);
  const learned = new Set(Object.keys(save.cards));
  const left = Math.max(0, save.settings.dailyGoal - learnedToday(save.stats, new Date(now)) - due.length);
  const fresh = nextWordIds(left, learned, save.settings.activeBook, books);
  return { due, fresh, total: due.length + fresh.length };
}

export function buildSession(save: SaveFile, books: Book[], now = Date.now()): ActiveSession {
  const plan = buildPlan(save, books, now);
  const book = books.find((b) => b.id === save.settings.activeBook) ?? books[0];
  const pool = (book?.units ?? []).flatMap((u) => u.wordIds).map(wordOf).filter((w): w is Word => !!w);
  const steps: Step[] = [];
  let seed = now % 9973;

  for (const id of [...plan.due, ...plan.fresh]) {
    const word = wordOf(id);
    if (!word) continue;
    seed += 7;
    steps.push({ wordId: id, kind: "listen" });
    steps.push({ wordId: id, kind: "meaning", options: optionSet(word, pool.length >= 4 ? pool : catalog.words, seed) });
    steps.push({ wordId: id, kind: "spell" });
    steps.push({ wordId: id, kind: "reveal" });
  }

  return {
    id: `s${now}`,
    started: now,
    steps,
    index: 0,
    graded: {},
    newIds: plan.fresh,
    reviewIds: plan.due,
    errors: {},
  };
}

export function gradeForErrors(errors: number, selfHard: boolean): Grade {
  if (errors >= 2) return Rating.Again;
  if (errors >= 1) return Rating.Hard;
  return selfHard ? Rating.Hard : Rating.Good;
}

export function todayProgress(save: SaveFile, now = new Date()) {
  return { done: learnedToday(save.stats, now), goal: save.settings.dailyGoal };
}

/* ---------- store 动作 ---------- */

export function startSession(books: Book[]) {
  actions.update((s) => ({ ...s, session: buildSession(s, books) }));
}

export function answer(correct: boolean) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    const step = sess.steps[sess.index];
    if (!step || (step.kind !== "meaning" && step.kind !== "spell")) return s;
    const errors = correct ? sess.errors : { ...sess.errors, [step.wordId]: (sess.errors[step.wordId] ?? 0) + 1 };
    return { ...s, session: { ...sess, errors, pending: { correct } } };
  });
}

export function next(now = Date.now()) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    const index = sess.index + 1;
    return {
      ...s,
      session: { ...sess, index, pending: undefined, finished: index >= sess.steps.length ? now : undefined },
    };
  });
}

/** 在认读步骤结算本词评分，并在 Again 时追加一次复习。 */
export function finishWord(selfHard: boolean, now = Date.now()) {
  actions.update((s) => {
    const sess = s.session;
    if (!sess) return s;
    const step = sess.steps[sess.index];
    if (!step || step.kind !== "reveal") return s;

    const advance = (steps = sess.steps) => {
      const index = sess.index + 1;
      return {
        ...s,
        session: {
          ...sess, steps, index, pending: undefined,
          finished: index >= steps.length ? now : undefined,
        },
      };
    };

    if (step.retry || sess.graded[step.wordId] !== undefined) return advance();

    const grade = gradeForErrors(sess.errors[step.wordId] ?? 0, selfHard);
    const card = review(s.cards[step.wordId], grade, now);
    const isNew = sess.newIds.includes(step.wordId);
    const stats = bumpDay(
      s.stats,
      { learned: isNew ? 1 : 0, reviewed: 1, correct: grade === Rating.Again ? 0 : 1, total: 1 },
      new Date(now),
    );
    const steps = grade === Rating.Again ? [...sess.steps, { wordId: step.wordId, kind: "reveal", retry: true }] : sess.steps;

    return {
      ...s,
      cards: { ...s.cards, [step.wordId]: card },
      stats,
      session: {
        ...sess, steps, errors: sess.errors, graded: { ...sess.graded, [step.wordId]: grade },
        index: sess.index + 1, pending: undefined,
        finished: sess.index + 1 >= steps.length ? now : undefined,
      },
    };
  });
}

export function abortSession() {
  actions.update((s) => ({ ...s, session: null }));
}

/** 今天是否还有可学内容，用于首页按钮文案。 */
export function hasMoreToday(save: SaveFile, books: Book[]) {
  const plan = buildPlan(save, books);
  return plan.total > 0;
}

export const dayStamp = () => dayKey();
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run src/store/session.test.ts`
Expected: 8 个用例 PASS。若“选义题四个不同选项”因词库同义重复失败，把 `optionSet` 的候选池扩大到 `catalog.words`。

- [ ] **Step 5: 提交**

```bash
git add src/store/session.ts src/store/session.test.ts
git commit -m "feat: add daily plan and four-step session engine"
```

---

### Task 10: 路由与页面骨架

**Files:**
- Create: `word-sprout/src/lib/router.ts`
- Create: `word-sprout/src/lib/router.test.ts`
- Create: `word-sprout/src/ui/Nav.tsx`
- Modify: `word-sprout/src/App.tsx`

**Interfaces:**
- Consumes: 无
- Produces:
  - `Route` 联合类型
  - `parseHash(hash): Route`
  - `href(route): string`
  - `go(route, replace?)`
  - `useRoute(): Route`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/router.test.ts
import { describe, expect, it } from "vitest";
import { href, parseHash } from "./router";

describe("parseHash", () => {
  it("空 hash 回首页", () => {
    expect(parseHash("")).toEqual({ page: "today" });
    expect(parseHash("#/")).toEqual({ page: "today" });
  });

  it("解析花圃与册参数", () => {
    expect(parseHash("#/garden?book=4A")).toEqual({ page: "garden", book: "4A" });
    expect(parseHash("#/garden")).toEqual({ page: "garden", book: undefined });
  });

  it("解析词卡 id", () => {
    expect(parseHash("#/word/w%3Aapple")).toEqual({ page: "word", id: "w:apple" });
  });

  it("未知路径回首页", () => {
    expect(parseHash("#/nope")).toEqual({ page: "today" });
  });
});

describe("href", () => {
  it("往返一致", () => {
    for (const route of [{ page: "learn" as const }, { page: "garden" as const, book: "5B" as const }, { page: "word" as const, id: "w:hi" }]) {
      expect(parseHash(href(route))).toEqual(route);
    }
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/router.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 router.ts**

```ts
// src/lib/router.ts
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

export const useRoute = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => current,
    () => current,
  );

export function go(route: Route, replace = false) {
  const h = href(route);
  if (replace) history.replaceState(null, "", h);
  else history.pushState(null, "", h);
  current = parseHash(h);
  subs.forEach((f) => f());
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

export const currentRoute = () => current;
```

- [ ] **Step 4: 实现 App 骨架**

```tsx
// src/App.tsx
import { useRoute } from "./lib/router";
import { Nav } from "./ui/Nav";
import { Garden } from "./pages/Garden";
import { Learn } from "./pages/Learn";
import { Me } from "./pages/Me";
import { Onboarding } from "./pages/Onboarding";
import { Today } from "./pages/Today";
import { Word } from "./pages/Word";

export function App() {
  const route = useRoute();
  const fullScreen = route.page === "learn" || route.page === "onboarding";

  return (
    <div className={fullScreen ? "app app-full" : "app"}>
      {route.page === "today" && <Today />}
      {route.page === "garden" && <Garden book={route.book} />}
      {route.page === "learn" && <Learn />}
      {route.page === "word" && <Word id={route.id} />}
      {route.page === "me" && <Me />}
      {route.page === "onboarding" && <Onboarding />}
      {!fullScreen && <Nav page={route.page} />}
    </div>
  );
}
```

页面文件在后续任务创建。本步骤先建占位，保证编译通过：

```tsx
// 依次创建 src/pages/Today.tsx、Garden.tsx、Learn.tsx、Word.tsx、Me.tsx、Onboarding.tsx
export function Today() {
  return <main className="app-shell">花园</main>;
}
```

其余五个页面照此各写一个同名导出函数，内容分别为“花圃”“学习”“词卡”“我的”“引导”。

底部导航（依赖路由，因此在本任务创建）：

```tsx
// src/ui/Nav.tsx
import { go, type Route } from "../lib/router";

const ITEMS: { page: "today" | "garden" | "me"; label: string; icon: string }[] = [
  { page: "today", label: "花园", icon: "🌱" },
  { page: "garden", label: "花圃", icon: "🪴" },
  { page: "me", label: "我的", icon: "🌼" },
];

export function Nav({ page }: { page: Route["page"] }) {
  return (
    <nav className="nav" aria-label="主导航">
      {ITEMS.map((it) => (
        <button
          key={it.page}
          type="button"
          className={page === it.page ? "nav-item is-active" : "nav-item"}
          aria-current={page === it.page ? "page" : undefined}
          onClick={() => go({ page: it.page } as Route)}
        >
          <span aria-hidden="true">{it.icon}</span>
          {it.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 5: 运行测试与构建**

Run: `npx vitest run src/lib/router.test.ts`
Expected: 5 个用例 PASS。

Run: `npm run build`
Expected: 构建通过。

- [ ] **Step 6: 提交**

```bash
git add src/lib/router.ts src/lib/router.test.ts src/App.tsx src/pages
git commit -m "feat: add hash router and page shell"
```

---

### Task 11: 基础 UI 组件

**Files:**
- Create: `word-sprout/src/ui/Sprout.tsx`
- Create: `word-sprout/src/ui/Ring.tsx`
- Create: `word-sprout/src/ui/GardenBed.tsx`
- Create: `word-sprout/src/ui/Speak.tsx`
- Create: `word-sprout/src/ui/Sheet.tsx`
- Create: `word-sprout/src/ui/Toast.tsx`
- Create: `word-sprout/src/lib/speech.ts`
- Create: `word-sprout/src/lib/speech.test.ts`
- Create: `word-sprout/src/lib/text.ts`
- Modify: `word-sprout/src/styles/app.css`

**Interfaces:**
- Consumes: `Stage`、`Progress`、`Route`
- Produces:
  - `<Sprout stage size />`
  - `<Ring value max size label />`
  - `<GardenBed wordIds cards />`
  - `<Speak text accent rate />`
  - `<Sheet open title onClose children />`
  - `<Toast message onDone />`
  - `<Nav page />`
  - `speak(text, opts): boolean`、`pickVoice(voices, accent)`

- [ ] **Step 1: 写 speech 的失败测试**

```ts
// src/lib/speech.test.ts
import { describe, expect, it } from "vitest";
import { pickVoice } from "./speech";

const voice = (lang: string, name: string) => ({ lang, name }) as SpeechSynthesisVoice;

describe("pickVoice", () => {
  it("优先完全匹配口音", () => {
    const v = pickVoice([voice("en-US", "A"), voice("en-GB", "B")], "uk");
    expect(v?.name).toBe("B");
  });

  it("没有完全匹配时回退任意英语", () => {
    const v = pickVoice([voice("en-AU", "C")], "uk");
    expect(v?.name).toBe("C");
  });

  it("没有英语语音返回 null", () => {
    expect(pickVoice([voice("zh-CN", "D")], "us")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/lib/speech.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 speech.ts 与 text.ts**

```ts
// src/lib/speech.ts
export interface SpeakOptions {
  accent?: "uk" | "us";
  rate?: number;
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

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 朗读失败返回 false，调用方据此隐藏喇叭或提示。 */
export function speak(text: string, { accent = "uk", rate = 1 }: SpeakOptions = {}): boolean {
  if (!canSpeak() || !text) return false;
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(synth.getVoices(), accent);
  if (voice) utter.voice = voice;
  utter.lang = voice?.lang ?? (accent === "uk" ? "en-GB" : "en-US");
  utter.rate = rate;
  synth.cancel();
  synth.speak(utter);
  return true;
}
```

```ts
// src/lib/text.ts
/** 按种子稳定打乱，保证同一会话重绘不变。 */
export function shuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = Math.abs(Math.floor(seed)) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const firstLetter = (text: string) => (text.trim()[0] ?? "?").toUpperCase();
```

- [ ] **Step 4: 实现组件**

```tsx
// src/ui/Sprout.tsx
import type { Stage } from "../store/garden";

/** 四阶段植物，纯 SVG，无外部图片。 */
export function Sprout({ stage, size = 48 }: { stage: Stage; size?: number }) {
  const stroke = "#4E9B5F";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={`植物阶段 ${stage}`}>
      <ellipse cx="24" cy="42" rx="14" ry="4" fill="#EDE1CC" />
      {stage === 0 && <circle cx="24" cy="38" r="3.5" fill="#A9744F" />}
      {stage >= 1 && (
        <>
          <path d="M24 40 V28" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <path d="M24 31 C18 31 15 27 15 23 C20 23 24 26 24 31 Z" fill={stroke} />
        </>
      )}
      {stage >= 2 && <path d="M24 33 C30 33 33 29 33 25 C28 25 24 28 24 33 Z" fill="#6FB572" />}
      {stage >= 3 && (
        <>
          <circle cx="24" cy="20" r="6" fill="#F5C542" />
          <circle cx="24" cy="20" r="2.5" fill="#FFF3C4" />
        </>
      )}
    </svg>
  );
}
```

```tsx
// src/ui/Ring.tsx
export function Ring({ value, max, size = 120, label }: { value: number; max: number; size?: number; label?: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFE5D4" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#4E9B5F" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-text">
        <strong>{value}</strong>
        <span>{label ?? `/ ${max}`}</span>
      </div>
    </div>
  );
}
```

```tsx
// src/ui/GardenBed.tsx
import type { CardState } from "../store/srs";
import { stageOf } from "../store/garden";
import { Sprout } from "./Sprout";

export function GardenBed({ wordIds, cards }: { wordIds: string[]; cards: Record<string, CardState> }) {
  return (
    <div className="bed" role="list">
      {wordIds.map((id) => (
        <div className="bed-cell" key={id} role="listitem">
          <Sprout stage={stageOf(cards[id])} size={40} />
        </div>
      ))}
    </div>
  );
}
```

```tsx
// src/ui/Speak.tsx
import { useState } from "react";
import { canSpeak, speak } from "../lib/speech";

export function Speak({ text, accent = "uk", rate = 1, size = 18 }: { text: string; accent?: "uk" | "us"; rate?: number; size?: number }) {
  const [on, setOn] = useState(false);
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className={`speak ${on ? "is-on" : ""}`}
      aria-label={`朗读 ${text}`}
      onClick={(e) => {
        e.stopPropagation();
        setOn(true);
        speak(text, { accent, rate });
        window.setTimeout(() => setOn(false), 600);
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M17 8a5 5 0 0 1 0 8" />
      </svg>
    </button>
  );
}
```

```tsx
// src/ui/Sheet.tsx
import { useEffect, type ReactNode } from "react";

export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-mask" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}
```

```tsx
// src/ui/Toast.tsx
import { useEffect } from "react";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return <div className="toast" role="status" aria-live="polite">{message}</div>;
}
```

- [ ] **Step 5: 追加样式**

```css
.app { max-width: 720px; margin: 0 auto; padding: 20px 18px 96px; }
.app-full { max-width: 720px; padding-bottom: 24px; }
.app-shell { padding: 8px 2px; }

.nav {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; justify-content: center; gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: rgba(253, 248, 238, 0.94);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(8px);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-width: 72px; padding: 6px 10px; border-radius: 16px;
  color: var(--ink-soft); font-size: 12px;
}
.nav-item.is-active { color: var(--leaf); background: var(--leaf-soft); }

.ring { position: relative; display: grid; place-items: center; }
.ring-text { position: absolute; display: flex; flex-direction: column; align-items: center; }
.ring-text strong { font-size: 28px; }
.ring-text span { font-size: 12px; color: var(--ink-soft); }

.bed { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.bed-cell { display: grid; place-items: center; min-height: 44px; }

.speak {
  display: inline-grid; place-items: center;
  width: 44px; height: 44px; border-radius: 50%;
  color: var(--leaf); background: var(--leaf-soft);
}
.speak.is-on { transform: scale(0.94); }

.sheet-mask {
  position: fixed; inset: 0; background: rgba(61, 58, 52, 0.28);
  display: grid; align-items: end; z-index: 40;
}
.sheet {
  background: var(--card); border-radius: 28px 28px 0 0;
  padding: 18px 18px calc(24px + env(safe-area-inset-bottom));
  max-height: 86vh; overflow: auto;
}
.sheet-head { display: flex; justify-content: space-between; align-items: center; }
.sheet-head h2 { font-size: 18px; margin: 0; }

.toast {
  position: fixed; left: 50%; bottom: 88px; transform: translateX(-50%);
  background: var(--ink); color: var(--paper);
  padding: 10px 16px; border-radius: 999px; font-size: 14px; z-index: 60;
}
```

- [ ] **Step 6: 运行测试与构建**

Run: `npx vitest run src/lib/speech.test.ts`
Expected: 3 个用例 PASS。

Run: `npm run build`
Expected: 构建通过。

- [ ] **Step 7: 提交**

```bash
git add src/ui src/lib/speech.ts src/lib/text.ts src/styles/app.css
git commit -m "feat: add sprout visual primitives and speech helper"
```

---

### Task 12: 花园首页与首次引导

**Files:**
- Create: `word-sprout/src/data/useBooks.ts`
- Create: `word-sprout/src/pages/Today.tsx`
- Create: `word-sprout/src/pages/Onboarding.tsx`
- Modify: `word-sprout/src/styles/app.css`

**Interfaces:**
- Consumes: `useSave`、`buildPlan`、`startSession`、`todayProgress`、`loadBook`
- Produces:
  - `useAllBooks(): Book[] | null`
  - `<Today />`、`<Onboarding />`

- [ ] **Step 1: 写全量教材加载 hook**

```ts
// src/data/useBooks.ts
import { useEffect, useState } from "react";
import { catalog, loadBook } from "./catalog";
import type { Book } from "./types";

let all: Book[] | null = null;

export function useAllBooks(): Book[] | null {
  const [books, setBooks] = useState<Book[] | null>(all);
  useEffect(() => {
    if (all) return;
    let alive = true;
    Promise.all(catalog.bookIds.map(loadBook)).then((list) => {
      all = list;
      if (alive) setBooks(list);
    });
    return () => {
      alive = false;
    };
  }, []);
  return books;
}
```

- [ ] **Step 2: 实现首页**

```tsx
// src/pages/Today.tsx
import { useEffect, useMemo } from "react";
import { useAllBooks } from "../data/useBooks";
import { go } from "../lib/router";
import { progressOf } from "../store/garden";
import { buildPlan, startSession, todayProgress } from "../store/session";
import { useSave } from "../store/store";
import { Ring } from "../ui/Ring";
import { Sprout } from "../ui/Sprout";

export function Today() {
  const save = useSave((s) => s);
  const books = useAllBooks();
  const { done, goal } = todayProgress(save);

  useEffect(() => {
    if (!save.settings.onboarded) go({ page: "onboarding" }, true);
  }, [save.settings.onboarded]);

  const book = books?.find((b) => b.id === save.settings.activeBook) ?? null;
  const plan = books ? buildPlan(save, books) : null;

  const bed = useMemo(() => {
    if (!book) return null;
    const unit = book.units.find((u) => progressOf(u.wordIds, save.cards).bloomed < u.wordIds.length) ?? book.units[0];
    return unit ? { unit, progress: progressOf(unit.wordIds, save.cards) } : null;
  }, [book, save.cards]);

  const start = () => {
    if (!books) return;
    if (!save.session) startSession(books);
    go({ page: "learn" });
  };

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">今天也来浇浇水</p>
          <h1>你好，小园丁</h1>
        </div>
        <div className="streak" aria-label={`连续学习 ${save.stats.streak} 天`}>
          🔥 <strong>{save.stats.streak}</strong> 天
        </div>
      </header>

      <section className="card today-ring">
        <Ring value={done} max={goal} label={`/ ${goal} 词`} />
        <div className="today-ring-copy">
          <h2>{done >= goal ? "今天的种子浇完啦" : "今天还有种子等着你"}</h2>
          <p>{save.session ? "上次没学完，接着来。" : `约 ${Math.max(3, Math.round((goal - done) * 0.8))} 分钟`}</p>
          <button type="button" className="btn-primary" onClick={start} disabled={!books}>
            {save.session ? "继续学习" : done >= goal ? "再学一组" : "开始学习"}
          </button>
        </div>
      </section>

      {bed && (
        <section className="card">
          <div className="card-head">
            <h2>{bed.unit.titleZh || bed.unit.title}</h2>
            <span className="muted">{bed.progress.bloomed}/{bed.progress.total} 开花</span>
          </div>
          <div className="bed-preview">
            {bed.unit.wordIds.slice(0, 8).map((id) => (
              <Sprout key={id} stage={progressOf([id], save.cards).bloomed > 0 ? 3 : 0} size={34} />
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => go({ page: "garden", book: book?.id })}>
            看看整片花圃
          </button>
        </section>
      )}

      {plan && plan.total === 0 && (
        <section className="card empty-card">
          <p>这本书的词都种下啦，去下一册看看吧。</p>
          <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>切换花圃</button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 实现引导页**

```tsx
// src/pages/Onboarding.tsx
import { useState } from "react";
import type { BookId } from "../data/types";
import { go } from "../lib/router";
import { actions } from "../store/store";

const BOOKS: { id: BookId; label: string }[] = [
  { id: "3A", label: "三年级上册" }, { id: "3B", label: "三年级下册" },
  { id: "4A", label: "四年级上册" }, { id: "4B", label: "四年级下册" },
  { id: "5A", label: "五年级上册" }, { id: "5B", label: "五年级下册" },
  { id: "6A", label: "六年级上册" }, { id: "6B", label: "六年级下册" },
];

const GOALS = [5, 10, 15, 20] as const;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [book, setBook] = useState<BookId>("3A");
  const [goal, setGoal] = useState<5 | 10 | 15 | 20>(10);

  const finish = () => {
    actions.settings({ activeBook: book, dailyGoal: goal, onboarded: true });
    go({ page: "today" }, true);
  };

  return (
    <main className="onboard">
      {step === 0 ? (
        <section>
          <p className="eyebrow">第 1 步，共 2 步</p>
          <h1>你现在用哪一册？</h1>
          <div className="choice-grid">
            {BOOKS.map((b) => (
              <button key={b.id} type="button" className={book === b.id ? "choice is-on" : "choice"} onClick={() => setBook(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary wide" onClick={() => setStep(1)}>下一步</button>
        </section>
      ) : (
        <section>
          <p className="eyebrow">第 2 步，共 2 步</p>
          <h1>每天想学几个词？</h1>
          <div className="choice-grid">
            {GOALS.map((g) => (
              <button key={g} type="button" className={goal === g ? "choice is-on" : "choice"} onClick={() => setGoal(g)}>
                {g} 个
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary wide" onClick={finish}>开始种词</button>
          <button type="button" className="btn-ghost wide" onClick={() => setStep(0)}>上一步</button>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 4: 追加首页与引导样式**

```css
.eyebrow { margin: 0 0 4px; font-size: 13px; color: var(--ink-soft); }
.today-head { display: flex; justify-content: space-between; align-items: flex-start; margin: 8px 0 18px; }
.today-head h1 { margin: 0; font-size: 24px; }
.streak { background: #fff2d0; color: #8a6a10; border-radius: 999px; padding: 8px 12px; font-size: 14px; }

.card { background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; margin-bottom: 14px; }
.today-ring { display: flex; gap: 18px; align-items: center; }
.today-ring-copy h2 { margin: 0 0 4px; font-size: 18px; }
.today-ring-copy p { margin: 0 0 12px; color: var(--ink-soft); font-size: 14px; }

.btn-primary {
  background: var(--leaf); color: #fff; border-radius: 999px;
  padding: 0 22px; font-weight: 700; min-height: 48px;
}
.btn-primary:disabled { opacity: 0.5; }
.btn-ghost { color: var(--leaf); min-height: 44px; padding: 0 12px; }
.wide { width: 100%; margin-top: 10px; }
.card-head { display: flex; justify-content: space-between; align-items: baseline; }
.card-head h2 { margin: 0; font-size: 17px; }
.muted { color: var(--ink-soft); font-size: 13px; }
.bed-preview { display: flex; gap: 2px; margin: 10px 0; }

.onboard { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
.onboard h1 { font-size: 26px; margin: 0 0 18px; }
.choice-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 18px; }
.choice { background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 14px; font-size: 15px; }
.choice.is-on { border-color: var(--leaf); background: var(--leaf-soft); color: var(--leaf); font-weight: 700; }
.empty-card { text-align: center; color: var(--ink-soft); }
```

- [ ] **Step 5: 验证**

Run: `npm run build`
Expected: 构建通过。

手工：`npm run dev`，首次打开跳到引导，选册与目标后回到首页，点开始进入学习页。

- [ ] **Step 6: 提交**

```bash
git add src/pages/Today.tsx src/pages/Onboarding.tsx src/data/useBooks.ts src/styles/app.css
git commit -m "feat: add garden home and onboarding"
```

---

### Task 13: 花圃浏览

**Files:**
- Create: `word-sprout/src/pages/Garden.tsx`
- Modify: `word-sprout/src/styles/app.css`

**Interfaces:**
- Consumes: `useBook`、`progressOf`、`useSave`、`GardenBed`、`Sheet`
- Produces: `<Garden book?: BookId />`

- [ ] **Step 1: 实现花圃页**

```tsx
// src/pages/Garden.tsx
import { useState } from "react";
import { useBook, unitWords } from "../data/catalog";
import type { BookId, Unit } from "../data/types";
import { go } from "../lib/router";
import { progressOf } from "../store/garden";
import { useSave } from "../store/store";
import { GardenBed } from "../ui/GardenBed";
import { Sheet } from "../ui/Sheet";
import { Sprout } from "../ui/Sprout";

const BOOK_IDS: BookId[] = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];
const SHORT: Record<BookId, string> = {
  "3A": "三上", "3B": "三下", "4A": "四上", "4B": "四下",
  "5A": "五上", "5B": "五下", "6A": "六上", "6B": "六下",
};

export function Garden({ book: initial }: { book?: BookId }) {
  const save = useSave((s) => s);
  const [id, setId] = useState<BookId>(initial ?? save.settings.activeBook);
  const [open, setOpen] = useState<Unit | null>(null);
  const book = useBook(id);

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">花圃</p>
          <h1>看看种到哪了</h1>
        </div>
      </header>

      <div className="book-tabs" role="tablist" aria-label="选择教材">
        {BOOK_IDS.map((b) => (
          <button
            key={b} type="button" role="tab" aria-selected={id === b}
            className={id === b ? "tab is-on" : "tab"}
            onClick={() => setId(b)}
          >
            {SHORT[b]}
          </button>
        ))}
      </div>

      {book && (
        <>
          <div className="book-title">
            <h2>{book.grade} 年级{book.term}册</h2>
            {book.edition === 2013 && <span className="badge">旧版</span>}
            {save.settings.activeBook === book.id && <span className="badge badge-green">当前</span>}
          </div>

          <div className="unit-list">
            {book.units.map((unit) => {
              const p = progressOf(unit.wordIds, save.cards);
              return (
                <button key={unit.id} type="button" className="card unit-card" onClick={() => setOpen(unit)}>
                  <div className="unit-head">
                    <strong>Unit {unit.no}</strong>
                    <span className="muted">{p.bloomed}/{p.total}</span>
                  </div>
                  <p className="unit-title">{unit.titleZh || unit.title}</p>
                  <GardenBed wordIds={unit.wordIds} cards={save.cards} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={!!open} title={open ? open.titleZh || open.title : ""} onClose={() => setOpen(null)}>
        {open && book && (
          <ul className="word-list">
            {unitWords(open).map((w) => (
              <li key={w.id}>
                <button type="button" className="word-row" onClick={() => go({ page: "word", id: w.id })}>
                  <Sprout stage={progressOf([w.id], save.cards).bloomed ? 3 : progressOf([w.id], save.cards).sprouted ? 1 : 0} size={30} />
                  <span className="word-row-text">
                    <strong>{w.text}</strong>
                    <span className="muted">{w.zh}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </main>
  );
}
```

- [ ] **Step 2: 追加样式**

```css
.book-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 12px; }
.tab { flex: 0 0 auto; border-radius: 999px; padding: 0 14px; background: var(--card); color: var(--ink-soft); }
.tab.is-on { background: var(--leaf); color: #fff; }
.book-title { display: flex; align-items: center; gap: 8px; margin: 6px 0 12px; }
.book-title h2 { margin: 0; font-size: 20px; }
.badge { font-size: 12px; border-radius: 999px; padding: 3px 8px; background: #f4e6cf; color: #7a5a2e; }
.badge-green { background: var(--leaf-soft); color: var(--leaf); }
.unit-list { display: grid; gap: 12px; }
.unit-card { text-align: left; }
.unit-head { display: flex; justify-content: space-between; align-items: baseline; }
.unit-title { margin: 4px 0 8px; color: var(--ink-soft); font-size: 14px; }
.word-list { list-style: none; margin: 12px 0 0; padding: 0; }
.word-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 0; }
.word-row-text { display: flex; flex-direction: column; }
```

- [ ] **Step 3: 验证**

Run: `npm run build`
Expected: 构建通过。

手工：切换 8 个册页签，五下与六下显示“旧版”，点单元弹出词表，点词跳词卡。

- [ ] **Step 4: 提交**

```bash
git add src/pages/Garden.tsx src/styles/app.css
git commit -m "feat: add garden bed browsing with edition badges"
```

---

### Task 14: 学习会话界面

**Files:**
- Create: `word-sprout/src/pages/Learn.tsx`
- Modify: `word-sprout/src/styles/app.css`

**Interfaces:**
- Consumes: `useSave`、`catalog`、`startSession`、`answer`、`next`、`finishWord`、`abortSession`、`useAllBooks`
- Produces: `<Learn />`

- [ ] **Step 1: 实现学习页**

```tsx
// src/pages/Learn.tsx
import { useEffect, useMemo, useState } from "react";
import { catalog } from "../data/catalog";
import { useAllBooks } from "../data/useBooks";
import { firstLetter, shuffle } from "../lib/text";
import { go } from "../lib/router";
import { answer, abortSession, finishWord, next, startSession } from "../store/session";
import { useSave } from "../store/store";
import { Speak } from "../ui/Speak";

export function Learn() {
  const save = useSave((s) => s);
  const books = useAllBooks();
  const session = save.session;
  const [picked, setPicked] = useState<number[]>([]);

  useEffect(() => {
    if (!session && books) startSession(books);
  }, [session, books]);

  const step = session?.steps[session.index];
  const word = step ? catalog.byId.get(step.wordId) : undefined;
  const total = session?.steps.length ?? 0;

  const tiles = useMemo(() => {
    if (!word) return [];
    const letters = word.text.toLowerCase().replace(/[^a-z']/g, "").split("");
    return shuffle(letters, (step?.wordId.length ?? 1) * 31 + (session?.index ?? 0));
  }, [word, step?.wordId, session?.index]);

  useEffect(() => setPicked([]), [session?.index]);

  if (!session) {
    return <main className="learn"><p className="muted">正在准备种子…</p></main>;
  }

  if (session.finished) {
    const graded = Object.values(session.graded);
    const correct = graded.filter((g) => g !== 1).length;
    return (
      <main className="learn learn-done">
        <h1>今天的花长出来了</h1>
        <p className="muted">复习 {graded.length} 个词，答对 {correct} 个</p>
        <div className="done-sprouts">
          {session.newIds.slice(0, 10).map((id) => <span key={id}>🌱</span>)}
        </div>
        <button type="button" className="btn-primary wide" onClick={() => go({ page: "today" })}>回花园</button>
      </main>
    );
  }

  if (!step || !word) {
    return <main className="learn"><button type="button" className="btn-primary" onClick={() => go({ page: "today" })}>回花园</button></main>;
  }

  const progress = Math.round((session.index / Math.max(1, total)) * 100);

  const build = picked.map((i) => tiles[i]).join("");
  const target = word.text.toLowerCase().replace(/[^a-z']/g, "");

  return (
    <main className="learn">
      <header className="learn-head">
        <button type="button" className="btn-ghost" onClick={() => { abortSession(); go({ page: "today" }); }}>退出</button>
        <div className="learn-bar" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <span className="muted">{session.index + 1}/{total}</span>
      </header>

      {step.kind === "listen" && (
        <section className="learn-card">
          <p className="eyebrow">先听一听</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={132} height={132} /> : <span>{firstLetter(word.text)}</span>}</div>
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={30} />
          <h1>{word.text}</h1>
          <button type="button" className="btn-primary wide" onClick={() => next()}>我听到了</button>
        </section>
      )}

      {step.kind === "meaning" && (
        <section className="learn-card">
          <p className="eyebrow">它是什么意思？</p>
          <h1>{word.text}</h1>
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
          <div className="options">
            {(step.options ?? []).map((opt) => (
              <button
                key={opt} type="button" className="option"
                disabled={!!session.pending}
                onClick={() => answer(opt === word.zh)}
              >
                {opt}
              </button>
            ))}
          </div>
          {session.pending && <Feedback correct={session.pending.correct} onNext={() => next()} />}
        </section>
      )}

      {step.kind === "spell" && (
        <section className="learn-card">
          <p className="eyebrow">拼一拼</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={110} height={110} /> : <span>{firstLetter(word.text)}</span>}</div>
          <p className="muted">{word.zh}</p>
          <div className="slots" aria-live="polite">
            {picked.map((i, at) => (
              <button key={`${i}-${at}`} type="button" className="slot" onClick={() => setPicked(picked.filter((_, k) => k !== at))}>{tiles[i]}</button>
            ))}
            {picked.length === 0 && <span className="muted">点下面的字母</span>}
          </div>
          <div className="tiles">
            {tiles.map((ch, i) => (
              <button key={i} type="button" className="tile" disabled={picked.includes(i) || !!session.pending} onClick={() => setPicked([...picked, i])}>{ch}</button>
            ))}
          </div>
          {!session.pending ? (
            <button type="button" className="btn-primary wide" disabled={picked.length !== tiles.length} onClick={() => answer(build === target)}>检查</button>
          ) : (
            <Feedback correct={session.pending.correct} onNext={() => next()} />
          )}
        </section>
      )}

      {step.kind === "reveal" && (
        <section className="learn-card">
          <p className="eyebrow">认一认</p>
          <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={110} height={110} /> : <span>{firstLetter(word.text)}</span>}</div>
          <h1>{word.text}</h1>
          {word.ipa && <p className="ipa">/{word.ipa}/</p>}
          <p className="meaning">{word.pos ? `${word.pos}. ` : ""}{word.zh}</p>
          {word.example && <p className="example">{word.example.en}<br /><span className="muted">{word.example.zh}</span></p>}
          <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
          <div className="reveal-actions">
            <button type="button" className="btn-ghost" onClick={() => finishWord(true)}>有点难</button>
            <button type="button" className="btn-primary" onClick={() => finishWord(false)}>记住了</button>
          </div>
        </section>
      )}
    </main>
  );
}

function Feedback({ correct, onNext }: { correct: boolean; onNext: () => void }) {
  return (
    <div className={correct ? "feedback is-ok" : "feedback is-bad"} role="status" aria-live="polite">
      <span>{correct ? "对了" : "再记一次"}</span>
      <button type="button" className="btn-primary" onClick={onNext}>继续</button>
    </div>
  );
}
```

- [ ] **Step 2: 追加样式**

```css
.learn { max-width: 620px; margin: 0 auto; padding: 16px 18px 32px; min-height: 100%; display: flex; flex-direction: column; }
.learn-head { display: flex; align-items: center; gap: 10px; }
.learn-bar { flex: 1; height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
.learn-bar span { display: block; height: 100%; background: var(--leaf); transition: width 0.3s ease; }
.learn-card { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; }
.learn-card h1 { font-size: 40px; margin: 0; letter-spacing: 0.01em; }
.big-emoji { display: grid; place-items: center; width: 148px; height: 148px; border-radius: 36px; background: var(--card); box-shadow: var(--shadow); font-size: 64px; font-weight: 800; color: var(--leaf); }
.ipa { color: var(--ink-soft); margin: 0; }
.meaning { font-size: 20px; margin: 4px 0; }
.example { color: var(--ink-soft); font-size: 15px; margin: 6px 0; }
.options { display: grid; gap: 10px; width: 100%; margin-top: 10px; }
.option { background: var(--card); border: 2px solid var(--line); border-radius: 18px; padding: 14px; font-size: 17px; }
.option:active { border-color: var(--leaf); }
.slots { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; min-height: 56px; }
.slot { width: 46px; height: 52px; border-radius: 12px; background: var(--leaf-soft); color: var(--leaf); font-size: 22px; font-weight: 700; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.tile { width: 46px; height: 52px; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); font-size: 22px; font-weight: 700; }
.tile:disabled { opacity: 0.35; }
.feedback { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 12px 16px; border-radius: 18px; }
.feedback.is-ok { background: var(--leaf-soft); color: var(--leaf); }
.feedback.is-bad { background: #fde8e4; color: #b4553f; }
.reveal-actions { display: flex; gap: 12px; width: 100%; margin-top: 12px; }
.reveal-actions > * { flex: 1; }
.learn-done { justify-content: center; align-items: center; text-align: center; }
.done-sprouts { font-size: 34px; letter-spacing: 6px; margin: 18px 0; }
```

- [ ] **Step 3: 验证**

Run: `npm run build`
Expected: 构建通过。

手工：完整走一组 5 词，确认听、选义、拼写、认读四步都出现；拼写答错后按钮可用；认读点“记住了”进入下一词；全部完成后进入总结页。

- [ ] **Step 4: 提交**

```bash
git add src/pages/Learn.tsx src/styles/app.css
git commit -m "feat: add four-step learning session"
```

---

### Task 15: 词卡与我的

**Files:**
- Create: `word-sprout/src/pages/Word.tsx`
- Create: `word-sprout/src/pages/Me.tsx`
- Modify: `word-sprout/src/styles/app.css`

**Interfaces:**
- Consumes: `getWord`、`progressOf`、`useSave`、`actions`、`serializeBackup`、`parseBackup`
- Produces: `<Word id />`、`<Me />`

- [ ] **Step 1: 实现词卡页**

```tsx
// src/pages/Word.tsx
import { getWord } from "../data/catalog";
import { go } from "../lib/router";
import { firstLetter } from "../lib/text";
import { stageOf, STAGE_LABEL } from "../store/garden";
import { useSave } from "../store/store";
import { Speak } from "../ui/Speak";
import { Sprout } from "../ui/Sprout";

const BOOK_NAME: Record<string, string> = {
  "3A": "三年级上册", "3B": "三年级下册", "4A": "四年级上册", "4B": "四年级下册",
  "5A": "五年级上册", "5B": "五年级下册", "6A": "六年级上册", "6B": "六年级下册",
};

const unitLabel = (uid: string) => {
  const [book, unit] = uid.split("-");
  return `${BOOK_NAME[book] ?? book} ${Number(unit?.replace("U", "")) || ""} 单元`;
};

export function Word({ id }: { id: string }) {
  const save = useSave((s) => s);
  const word = getWord(id);
  if (!word) {
    return (
      <main className="app-shell">
        <p>没有找到这个词。</p>
        <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>回花圃</button>
      </main>
    );
  }
  const stage = stageOf(save.cards[word.id]);

  return (
    <main className="app-shell">
      <button type="button" className="btn-ghost" onClick={() => go({ page: "garden" })}>返回</button>
      <section className="card word-card">
        <div className="big-emoji">{word.emoji ? <img src={`/emoji/${word.emoji}.svg`} alt="" width={132} height={132} /> : <span>{firstLetter(word.text)}</span>}</div>
        <h1>{word.text}</h1>
        {word.ipa && <p className="ipa">/{word.ipa}/</p>}
        <Speak text={word.text} accent={save.settings.accent} rate={save.settings.rate} size={26} />
        <p className="meaning">{word.pos ? `${word.pos}. ` : ""}{word.zh}</p>
        {word.example && (
          <p className="example">
            {word.example.en}
            <br />
            <span className="muted">{word.example.zh}</span>
          </p>
        )}
        <div className="word-stage">
          <Sprout stage={stage} size={44} />
          <span className="muted">{STAGE_LABEL[stage]}</span>
        </div>
      </section>

      <section className="card">
        <h2>出现在</h2>
        <ul className="unit-tags">
          {word.units.map((u) => <li key={u}>{unitLabel(u)}</li>)}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: 实现我的页**

```tsx
// src/pages/Me.tsx
import { useRef, useState } from "react";
import { parseBackup, serializeBackup, actions, useSave } from "../store/store";
import { Toast } from "../ui/Toast";

export function Me() {
  const save = useSave((s) => s);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportFile = () => {
    const blob = new Blob([serializeBackup(save)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `word-sprout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("备份已下载");
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseBackup(await file.text());
    if (result.ok) {
      actions.replace(result.save);
      setToast(`已导入 ${Object.keys(result.save.cards).length} 个词`);
    } else {
      setToast(result.error);
    }
  };

  return (
    <main className="app-shell">
      <header className="today-head">
        <div>
          <p className="eyebrow">我的</p>
          <h1>小园丁的设置</h1>
        </div>
      </header>

      <section className="card">
        <h2>每天学几个</h2>
        <div className="choice-grid compact">
          {([5, 10, 15, 20] as const).map((g) => (
            <button key={g} type="button" className={save.settings.dailyGoal === g ? "choice is-on" : "choice"} onClick={() => actions.settings({ dailyGoal: g })}>{g} 个</button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>发音</h2>
        <div className="choice-grid compact">
          <button type="button" className={save.settings.accent === "uk" ? "choice is-on" : "choice"} onClick={() => actions.settings({ accent: "uk" })}>英式</button>
          <button type="button" className={save.settings.accent === "us" ? "choice is-on" : "choice"} onClick={() => actions.settings({ accent: "us" })}>美式</button>
        </div>
        <label className="range-row">
          语速
          <input type="range" min={0.7} max={1.2} step={0.05} value={save.settings.rate} onChange={(e) => actions.settings({ rate: Number(e.target.value) })} />
          <span className="muted">{save.settings.rate.toFixed(2)}</span>
        </label>
        <div className="choice-grid compact">
          <button type="button" className={save.settings.motion === "off" ? "choice is-on" : "choice"} onClick={() => actions.settings({ motion: save.settings.motion === "off" ? "system" : "off" })}>
            动效：{save.settings.motion === "off" ? "关闭" : "跟随系统"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>备份</h2>
        <p className="muted">进度只存在这台设备，换设备前先导出。</p>
        <button type="button" className="btn-primary wide" onClick={exportFile}>导出备份</button>
        <button type="button" className="btn-ghost wide" onClick={() => fileRef.current?.click()}>导入备份</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        <button
          type="button" className="btn-ghost wide danger"
          onClick={() => {
            if (confirm("确定清空所有学习进度？这个操作不能撤销。")) {
              actions.reset();
              setToast("已清空");
            }
          }}
        >
          清空进度
        </button>
      </section>

      <section className="card">
        <h2>关于</h2>
        <p className="muted">词表来自人教版 PEP 英语教材，仅供本地个人学习使用。图标来自 OpenMoji，许可 CC BY-SA 4.0。</p>
      </section>

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}
```

- [ ] **Step 3: 追加样式**

```css
.word-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.word-card h1 { font-size: 38px; margin: 0; }
.word-stage { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.unit-tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 10px 0 0; }
.unit-tags li { background: var(--leaf-soft); color: var(--leaf); border-radius: 999px; padding: 6px 12px; font-size: 13px; }
.choice-grid.compact { grid-template-columns: repeat(4, 1fr); margin-bottom: 0; }
.range-row { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 14px; }
.range-row input { flex: 1; }
.danger { color: #b4553f; }
.word-card h2, .card h2 { font-size: 17px; margin: 0 0 8px; }
```

- [ ] **Step 4: 验证**

Run: `npm run build`
Expected: 构建通过。

手工：词卡显示音标、释义、出处；我的页改目标与口音后刷新仍保留；导出备份再导入，卡片数一致。

- [ ] **Step 5: 提交**

```bash
git add src/pages/Word.tsx src/pages/Me.tsx src/styles/app.css
git commit -m "feat: add word detail and settings with backup"
```

---

### Task 16: 响应式、可访问性与全量验收

**Files:**
- Modify: `word-sprout/src/styles/app.css`
- Modify: `word-sprout/src/App.tsx`
- Create: `word-sprout/README.md`

**Interfaces:**
- Consumes: 全部既有模块
- Produces: 可交付版本

- [ ] **Step 1: 补上保存失败提示与动效开关**

```tsx
// src/App.tsx 顶部引入
import { getSaveError, useSave } from "./store/store";
import { useEffect } from "react";

// 在 App 内新增
const motionOff = useSave((s) => s.settings.motion === "off");

useEffect(() => {
  document.documentElement.dataset.motion = motionOff ? "off" : "system";
}, [motionOff]);

// 在页面容器之前渲染
{getSaveError() && <div className="save-warning" role="alert">进度无法保存，可能是浏览器隐私模式或存储已满。</div>}
```

- [ ] **Step 2: 补响应式与细节样式**

```css
.save-warning { background: #fde8e4; color: #b4553f; padding: 8px 14px; font-size: 13px; text-align: center; }
html[data-motion="off"] *, html[data-motion="off"] *::before, html[data-motion="off"] *::after {
  animation: none !important; transition: none !important;
}

@media (max-width: 420px) {
  .today-ring { flex-direction: column; align-items: flex-start; }
  .learn-card h1 { font-size: 32px; }
  .big-emoji { width: 120px; height: 120px; border-radius: 28px; }
  .choice-grid.compact { grid-template-columns: repeat(2, 1fr); }
  .bed { grid-template-columns: repeat(5, 1fr); }
}

@media (min-width: 760px) {
  .unit-list { grid-template-columns: repeat(2, 1fr); }
}
```

- [ ] **Step 3: 写 README**

```markdown
# 词芽 Word Sprout

小学 PEP 英语单词花园。每天学一组词，学过的词在花圃里从种子长成花。

## 开发

```bash
npm install
npm run dev
```

## 教材数据

数据来自 8 本教材 PDF 的附录词表，构建产物在 `src/data`。

```bash
npm run data:extract   # 需要本机 D:\QMDownload 下有 8 本 PDF
npm run data:build     # 生成 src/data/index.json 与 src/data/books/*.json
```

`5B`、`6B` 目前是 2013 旧版，界面显示“旧版”徽标。拿到新版 PDF 后替换该册并重新构建即可，学习进度按词 id 保存，不受影响。

## 测试

```bash
npm test
npm run build
```

## 版权

教材词表版权属人民教育出版社，本项目仅供本地个人学习使用，不公开发布词库。图标来自 OpenMoji，许可 CC BY-SA 4.0。
```

- [ ] **Step 4: 全量测试**

Run: `npm test`
Expected: 以下文件全部通过，共约 50 个用例：
`scripts/parse-appendix.test.mjs`、`src/data/catalog.test.ts`、`src/store/srs.test.ts`、`src/store/stats.test.ts`、`src/store/garden.test.ts`、`src/store/store.test.ts`、`src/store/session.test.ts`、`src/lib/router.test.ts`、`src/lib/speech.test.ts`。

- [ ] **Step 5: 生产构建**

Run: `npm run build`
Expected: 无 TypeScript 错误，`dist/` 生成，主包体积小于 400KB（gzip 前）。

- [ ] **Step 6: 手工验收清单**

逐项确认，任一项不通过则回到对应任务修复：

1. 首次打开进入引导，两步后落到首页。
2. 首页显示今日环、连续天数、当前单元苗床。
3. 开始学习后四步依次出现，拼写可撤回重排。
4. 答错两题后该词在队列末尾再出现一次认读。
5. 完成一组后首页环前进，单元苗床有嫩芽。
6. 刷新页面后进度、设置、未完成会话都还在。
7. 花圃页 8 个册页签可切换，5B、6B 显示“旧版”。
8. 跨册重复词在多个单元的苗床同时点亮。
9. 词卡显示音标、释义、例句与出现单元。
10. 导出备份，清空进度，再导入，卡片数与设置恢复。
11. 375px 宽无横向滚动，按钮不小于 44px。
12. 键盘 Tab 能走完学习流程，焦点可见。

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "feat: polish responsive layout and accessibility"
```

---

## 计划自查

**规格覆盖**

| 设计文档章节 | 对应任务 |
|---|---|
| 4 数据源与版本 | Task 2、Task 3 |
| 5 信息架构 | Task 10、Task 12 到 Task 15 |
| 6 学习闭环 | Task 8、Task 9、Task 14 |
| 7 花园进度 | Task 7、Task 12、Task 13 |
| 8 视觉系统 | Task 1、Task 11、Task 16 |
| 9 数据模型 | Task 3、Task 4 |
| 10 技术架构 | Task 1 到 Task 16 |
| 11 存储结构 | Task 8 |
| 12 错误与边界 | Task 5、Task 6、Task 8、Task 11、Task 16 |
| 13 测试 | 每个任务的测试步骤、Task 16 |
| 14 验收标准 | Task 16 |
| 15 里程碑 | Task 1 到 Task 16 分阶段 |
| 16 风险 | Task 3 的旧版处理、Task 11 的 TTS 降级 |

**类型一致性**

- `CardState` 只在 `src/store/srs.ts` 定义，`store`、`garden`、`session` 均通过 `import type` 引用。
- `ActiveSession` 在 `session.ts` 定义，`store.ts` 用 `import type` 引用，运行期无循环依赖。
- `Progress` 在 `garden.ts` 定义，`Today`、`Garden` 使用 `progressOf` 返回同一结构。
- `buildSession`、`buildPlan` 的第三个参数 `now` 均为毫秒时间戳，测试与实现一致。
- `Stage` 为 `0 | 1 | 2 | 3`，`STAGE_LABEL` 与之一一对应。

**已知取舍**

- 例句与音标依赖构建期网络，失败时留空，界面隐藏对应行，不影响学习闭环。
- 图片使用 OpenMoji 文件名，构建脚本从 `node_modules/openmoji` 复制命中的 SVG 到 `public/emoji/`，未命中时回退首字母块，不阻塞任务完成。

---

## 执行方式

计划已保存到 `docs/superpowers/plans/2026-10-28-word-sprout-implementation.md`。

两种执行方式：

1. **子代理逐任务执行（推荐）**：每个任务派一个全新子代理，任务间我做审查，迭代快、上下文干净。
2. **当前会话批量执行**：用 executing-plans 按批次推进，每批结束设检查点。

选哪种？




