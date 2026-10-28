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
