const CJK = /[\u4e00-\u9fff]/;
const POS_RE = /\b(n|v|vt|vi|adj|adv|pron|prep|conj|num|art|int|aux|modal)\./gi;
const PAGE_RE = /\s*p\.\s*\d+\s*$/i;
const SKIP_RE = /^(Unit\b|Appendix\b|附录|注[:：]|Words in each unit|单\s*元\s*词\s*汇\s*表)/i;
const STOP_RE = /(Useful expressions|常用表达|Vocabulary|词\s*汇\s*表)/i;
// 允许 **then 这类双星标课标词。
const START_RE = /^\*{0,2}[A-Za-z]/;
// 2013 版 PDF 把音标里的斜杠编码成私用区 U+F02F。
const PUA_SLASH = /\uF02F/g;
// 同一物理行里紧跟在上一条中文释义后的第二个词条，如 "完成；做好finish /ˈfɪnɪʃ/ 完成；做好"。
const INLINE_RE = /^([\u4e00-\u9fff；，、）][\u4e00-\u9fff；，、）\s]*)([A-Za-z][A-Za-z'’.\- ]*\s*\/[^/]+\/.*)$/;
// 4B-U6 的 "Numbers / 数 词" 是分类小标题，不是词条。
const NUMBERS_RE = /^Numbers$/;
const NUMBERS_ZH_RE = /^数\s*词$/;
// 附录每页重复出现的页眉，不能进入词条缓冲。
const HEADER_RE = /^(Appendix\b|附录|Words in each unit|单\s*元\s*词\s*汇\s*表|注[:：])/i;

/** 去掉私用区字形（2013 版音标无法还原，交由覆盖表或联网补齐）。 */
const stripPua = (s) => s.replace(/[\uE000-\uF8FF]/g, "");

/** 规范化词条 id：小写、压缩空格、统一撇号。 */
export function normalizeId(text) {
  return "w:" + text.toLowerCase().trim().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
}

/** 解析一行词条，无法识别返回 null。 */
export function parseEntry(line) {
  let s = String(line).trim().replace(PUA_SLASH, "/");
  if (!s || SKIP_RE.test(s)) return null;
  const core = s.startsWith("*");
  if (core) s = s.replace(/^\*+/, "").trim();
  s = s.replace(PAGE_RE, "").trim();
  const cut = s.search(CJK);
  if (cut < 1) return null;

  // 音标后紧跟中文括号说明时，说明属于释义，词头取音标前的文本。
  const ipaMatch = /\/([^/]+)\//.exec(s);
  let text;
  let zh;
  let ipa = "";
  if (ipaMatch) {
    ipa = stripPua(ipaMatch[1]).trim();
    const after = s.slice(ipaMatch.index + ipaMatch[0].length);
    if (/^\s*[（(]/.test(after)) {
      text = s.slice(0, ipaMatch.index);
      zh = after;
    } else {
      text = s.slice(0, cut);
      zh = s.slice(cut);
    }
  } else {
    text = s.slice(0, cut);
    zh = s.slice(cut);
  }

  const posMatch = text.match(POS_RE) || zh.match(POS_RE);
  const pos = posMatch ? posMatch[0].replace(".", "").toLowerCase() : undefined;

  text = stripPua(text.replace(POS_RE, " "))
    .replace(/\*/g, "")
    .replace(/\/[^/]*\//g, " ")
    // 换行拆开的词头会留下 "Hong Kong -Zhuhai- Macao Bridge" 这类空格。
    .replace(/\s*-\s*/g, "-")
    .replace(/[（(]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  zh = stripPua(zh.replace(POS_RE, " "))
    .replace(/\*/g, "")
    .replace(/\/[^/]*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || !/[A-Za-z]/.test(text) || !zh) return null;
  // 拒绝 "Good morning!" 这类常用表达行。
  if (/[!?！？]$/.test(text)) return null;
  // 释义以拉丁字母开头时（T恤衫），把词头末尾的单字母移回释义。
  const moved = /^(.*\S)\s+([A-Za-z])$/.exec(text);
  if (moved && /^[\u4e00-\u9fff]/.test(zh)) {
    text = moved[1];
    zh = moved[2] + zh;
  }
  return { core, text, ipa, zh, pos };
}

/** 按 Unit 切分附录正文，遇到常用表达或词汇表即停止。 */
export function parseAppendix(text) {
  const units = [];
  let cur = null;
  let buf = [];
  let stopped = false;
  let skipNumbersZh = false;

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
    if (HEADER_RE.test(line)) { flush(); continue; }
    // "Numbers" 小标题后跟 "数 词" 时两行都跳过，但继续解析后面的数词。
    if (skipNumbersZh) {
      skipNumbersZh = false;
      if (NUMBERS_ZH_RE.test(line)) continue;
    }
    if (NUMBERS_RE.test(line) && cur) {
      skipNumbersZh = true;
      continue;
    }
    // 只在已进入 Unit 后才停止，避免附录标题 "单 元 词 汇 表" 触发停止。
    if (STOP_RE.test(line) && cur) { stopped = true; flush(); continue; }
    if (stopped) continue;
    const m = line.match(/^Unit\s+(\d+)\s*[:：]?\s*(.*)$/i);
    if (m) {
      flush();
      cur = { no: Number(m[1]), title: m[2].trim(), entries: [] };
      units.push(cur);
      continue;
    }
    if (!cur) continue;
    // 一行里挤进两条词条时，前半段并入上一条，后半段另起一条。
    // 若后半段能独立解析出释义，前半段只是上一行释义的残片，直接丢弃。
    const inline = line.match(INLINE_RE);
    if (inline) {
      const suffix = parseEntry(inline[2]);
      if (suffix?.zh) {
        flush();
        buf.push(inline[2]);
      } else {
        buf.push(inline[1]);
        flush();
        buf.push(inline[2]);
      }
      continue;
    }
    // 词条可能跨行：新词条以拉丁字母开头，纯中文续行并入上一条。
    // 但上一条还没有中文时，可能是词头被换行拆开（Hong Kong /.../-Zhuhai- + Macao ...），
    // 此时继续拼接；缓冲过长则放弃拼接，避免把多行噪声粘成一条。
    if (START_RE.test(line) && buf.length > 0) {
      const buffered = buf.join(" ");
      const hasCjk = buf.some((part) => CJK.test(part));
      const tooLong = buffered.length > 80;
      // 新行自带音标和释义时是完整词条，不能当作被换行拆开的词头。
      const looksLikeNewEntry = CJK.test(line) && /\/|\uF02F/.test(line);
      const continuesHeadword = /[-–—]\s*$/.test(buffered);
      if (hasCjk || tooLong || (looksLikeNewEntry && !continuesHeadword)) flush();
    }
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
