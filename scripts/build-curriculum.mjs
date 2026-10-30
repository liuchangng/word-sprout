import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeWords, normalizeId, parseAppendix } from "./parse-appendix.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "scripts", ".cache");
const OUT = path.join(ROOT, "src", "data");
const BOOKS = ["3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B"];
const EDITION = { "3A": 2024, "3B": 2024, "4A": 2024, "4B": 2024, "5A": 2024, "5B": 2013, "6A": 2024, "6B": 2013 };
// 单元中文标题按英文标题映射，5B/6B 目录顺序与单元号不一致，因此不能按行号取。
const TITLE_ZH = {
  "Making friends": "交朋友",
  "Different families": "不同的家庭",
  "Our animal friends": "我们的动物朋友",
  "Plants around us": "我们周围的植物",
  "The colourful world": "多彩的世界",
  "Useful numbers": "有用的数字",
  "Meeting new people": "认识新朋友",
  "My words and actions": "我的言行",
  "Tools and senses for learning": "学习的工具与感官",
  "Healthy food": "健康食物",
  "Old things": "旧物",
  "Numbers in life": "生活中的数字",
  "Helping at home": "在家帮忙",
  "My friends": "我的朋友",
  "Places we live in": "我们住的地方",
  "Helping in the community": "在社区帮忙",
  "The weather and us": "天气与我们",
  "Changing for the seasons": "四季的变化",
  "Class rules": "班级规则",
  "Family rules": "家庭规则",
  "Time for school": "上学时间",
  "Going shopping": "去购物",
  "Farms and us": "农场与我们",
  "From farm to table": "从农场到餐桌",
  "Different friends": "不同的朋友",
  "My feelings": "我的感受",
  "Work and play": "工作与玩耍",
  "Healthy habits": "健康习惯",
  "Food we eat": "我们吃的食物",
  "Nature and us": "自然与我们",
  "My day": "我的一天",
  "My favourite season": "我最喜欢的季节",
  "My school calendar": "我的学校日历",
  "When is the art show?": "美术展在什么时候？",
  "Whose dog is it?": "这是谁的狗？",
  "Work quietly!": "安静地做事！",
  "Amazing places": "奇妙的地方",
  "Getting together": "相聚",
  "Healthy life": "健康生活",
  "Managing money well": "好好理财",
  "Exploring space": "探索太空",
  "Energy, nature and us": "能源、自然与我们",
  "How tall are you?": "你有多高？",
  "Last weekend": "上个周末",
  "Where did you go?": "你去哪儿了？",
  "Then and now": "过去与现在",
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
const examples = readJson(path.join(CACHE, "examples.json"), {});
if (!Object.keys(examples).length) {
  console.warn("[警告] 缺少 scripts/.cache/examples.json，例句将全部缺失，请先运行 npm run data:examples");
}
const offline = process.argv.includes("--offline");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 联网补音标，成功才写缓存；超时或失败不落盘，避免永久标记为缺失。 */
async function enrich(word) {
  const key = normalizeId(word.text);
  if (cache[key]) return cache[key];
  if (offline) return null;
  const out = {};
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.text)}`, {
      signal: AbortSignal.timeout(8000),
    });
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
  if (!out.ipa) return null;
  cache[key] = out;
  writeJson(path.join(CACHE, "enrich.json"), cache);
  return out;
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

  for (const w of words) {
    // 例句来自教材正文，中文释义待补；缺失时词卡不显示例句
    const found = examples[w.id];
    if (found?.en) w.example = { en: found.en, zh: found.zh ?? "", src: "textbook" };
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
      w.ipa = extra?.ipa || "";
    }
  }

  let missingIpa = 0;
  let missingEmoji = 0;
  let missingExample = 0;
  let crossBook = 0;
  for (const w of words) {
    if (!w.ipa) missingIpa++;
    if (!w.emoji) missingEmoji++;
    if (!w.example) missingExample++;
    if (new Set(w.units.map((u) => u.split("-")[0])).size > 1) crossBook++;
  }

  for (const id of BOOKS) {
    const units = parsed[id].map((u) => {
      const uid = `${id}-U${u.no}`;
      // 目录标题缺失或中文映射缺失时直接失败，不写占位符。
      const title = raw[id]?.titles?.[u.no];
      if (!title) throw new Error(`[失败] ${uid} 缺少目录英文标题`);
      const titleZh = TITLE_ZH[title];
      if (!titleZh) throw new Error(`[失败] ${uid} 标题 "${title}" 缺少中文映射`);
      return {
        id: uid,
        no: u.no,
        title,
        titleZh,
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
  console.log(`[统计] 缺音标 ${missingIpa}，缺图 ${missingEmoji}，缺例句 ${missingExample}`);
  console.log(`[统计] 单元 ${books.reduce((n, b) => n + b.units.length, 0)} 个`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
