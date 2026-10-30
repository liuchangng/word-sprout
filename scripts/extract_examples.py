"""从 PEP 教材 PDF 正文抽取例句，输出 scripts/.cache/examples.json。

只扫描单元正文（Unit 1 起始页到 Revision/附录之前），按单元页码范围优先匹配，
过滤填空、指令、目录与词表噪声。输出结构：{ word_id: { en, book, page } }。
"""
import glob
import json
import os
import re
import sys

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF_DIR = r"D:\QMDownload"
OUT = os.path.join(ROOT, "scripts", ".cache", "examples.json")
INDEX = os.path.join(ROOT, "src", "data", "index.json")
# 印刷页码 + 5 = PDF 页码，8 本书一致（封面、扉页、目录共 4 页）。
OFFSET = 5
GRADE = {"三": 3, "四": 4, "五": 5, "六": 6}

# 板块标题、指令句和练习说明，不能当例句。
HEADER_RE = re.compile(
    r"^(?:"
    r"let'?s\s+(?:talk|try|check|learn|sing|chant|do|spell|find out|wrap it up|play|read|write|watch|make|act|draw)|"
    r"role-?play|story time|revision\b|unit\s+\d+|appendix\b|contents|"
    r"(?:listen|look|read|write|talk|draw|think|watch|count|choose|fill|work|act|play|sing|chant|say|point|wave|match|circle|number|tick|complete|ask|answer|repeat|spell|trace|colour|color|find|make|do|check)\s+and\s+\w+|"
    r"work in (?:pairs|groups)|in pairs|in groups|"
    r"fill in|choose words|number the|tick the|circle the|match the|"
    r"read the|look at the|listen to the|talk to|"
    r"read\s+\w+'s|write about|answer the|complete the|choose the|"
    r"match\b[^.!?]*\bto the|"
    r"what can you see|what are they doing"
    r")\b",
    re.I,
)
# 句中出现这些片段，说明是练习指令或带占位符的题干。
BAD_CONTAINS_RE = re.compile(
    r"(fill in|the blanks|your partner|your group|in pairs|in groups|"
    r"listen and|read and|look and|role-?play|tick the|circle the|"
    r"match the|number the|choose words|the pictures\b|"
    r"\(your |your name\)|→|•|_|\||ﬁ|ﬂ| to then |…|\.\.\.)",
    re.I,
)
SPEAKER_RE = re.compile(r"^(?:[A-Z][A-Za-z.'\- ]{0,24}|Mr\.|Mrs\.|Ms\.)\s*:\s*")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
SENT_END_RE = re.compile(r"[.!?][\"')\]]?$")
SENT_SHAPE_RE = re.compile(r"^[A-Z\"'][A-Za-z0-9 ,.'\"!?%:;()\-]*[.!?][\"')\]]?$")
# 上一行以这些词结尾时，下一行即使大写也是同一句（如 "eat dinner in" + "Spain?"）。
CONT_WORDS = {
    "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with",
    "from", "by", "as", "than", "is", "are", "was", "were", "be", "am",
    "have", "has", "had", "can", "will", "would", "should", "my", "your", "his",
    "her", "its", "our", "their", "this", "that", "these", "those", "not", "very", "so",
    "we", "you", "they", "he", "she", "it", "i", "last", "next", "first", "other",
    "another", "some", "any", "all", "both", "each", "every", "more", "most", "much",
    "many", "few", "big", "small", "good", "new", "old", "same", "different", "best",
    "better", "favourite", "favorite",
}
# 指令句里常见的动词：一句里有 2 个以上且其余都是连接词时判为板块指令。
INSTR_VERBS = {
    "match", "say", "act", "point", "wave", "count", "read", "write", "look", "listen",
    "talk", "draw", "choose", "tick", "number", "circle", "trace", "colour", "color",
    "fill", "work", "play", "sing", "chant", "do", "make", "find", "show", "tell",
    "repeat", "spell", "think", "watch", "ask", "answer", "guess", "discuss", "share",
    "report", "retell", "describe", "introduce", "greet", "practise", "practice",
    "complete", "check", "try", "open", "close", "turn", "take", "keep", "use", "put",
}
INSTR_FILLER = {
    "and", "or", "then", "please", "the", "a", "an", "it", "them", "in", "at", "to",
    "out", "up", "down", "this", "that", "these", "those", "your", "my", "our", "his",
    "her", "their", "with", "for", "by", "again", "together", "aloud", "carefully",
    "quietly", "loudly", "well", "now",
}
# 句中突然出现的祈使动词，通常是把两段文字拼成了一句。
MID_VERB_RE = re.compile(
    r"\s(?:Find|Look|Read|Write|Match|Say|Act|Talk|Listen|Draw|Choose|Tick|Circle|Number|Point|Wave|Count|Complete|Fill|Work|Play|Sing|Chant|Check|Try)\b"
)
# 句中突然大写的人称/功能词，说明两段文字被拼在一起了。
MID_CAP_RE = re.compile(r"(?<=[a-z])\s(?:It|This|That|These|Those)\b")


def book_id(name):
    grade = next((v for k, v in GRADE.items() if k in name), None)
    if grade is None:
        return None
    if "上册" in name:
        return f"{grade}A"
    if "下册" in name:
        return f"{grade}B"
    return None


def clean_text(text):
    """统一撇号与连字，去掉软连字符。"""
    return (
        text.replace("\u00ad", "")
        .replace("\ufb01", "fi")
        .replace("\ufb02", "fl")
        .replace("\u2019", "'")
        .replace("\u2018", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def parse_contents(doc):
    """返回目录条目 [(标题, 印刷页码)]；2013 版页码与标题分块，按同一行配对。"""
    for pno in range(min(12, len(doc))):
        page = doc[pno]
        if "CONTENTS" not in page.get_text().upper():
            continue
        blocks = [b for b in page.get_text("blocks") if b[4].strip()]
        inline, numbers, titles = [], [], []
        for b in blocks:
            text = clean_text(b[4]).strip()
            m = re.match(
                r"^(Unit\s+\d+[^\n]*?|Revision[^\n]*?|Recycle[^\n]*?|Appendix[^\n]*?)\s*\n\s*(\d{1,3})$",
                text,
            )
            if m:
                inline.append((" ".join(m.group(1).split()), int(m.group(2))))
                continue
            if re.fullmatch(r"\d{1,3}", text):
                numbers.append((float(b[1]), float(b[3]), int(text)))
            elif re.match(r"^(Unit\s+\d+|Revision\b|Recycle\b|Appendix\b)", text, re.I):
                titles.append((float(b[1]), float(b[3]), " ".join(text.split())))
        entries = list(inline)
        for y0, y1, title in titles:
            best = None
            for ny0, ny1, num in numbers:
                overlap = min(y1, ny1) - max(y0, ny0)
                if overlap > 0 and (best is None or overlap > best[0]):
                    best = (overlap, num)
            if best:
                entries.append((title, best[1]))
        if entries:
            return entries
    return []


def unit_ranges(entries):
    """单元号 -> (起始 PDF 页, 结束 PDF 页)，按目录中的下一个条目收尾。"""
    ordered = sorted(entries, key=lambda e: e[1])
    ranges = {}
    for i, (title, page) in enumerate(ordered):
        m = re.match(r"^Unit\s+(\d+)\b", title, re.I)
        if not m:
            continue
        end = ordered[i + 1][1] - 1 if i + 1 < len(ordered) else page + 11
        ranges[int(m.group(1))] = (page + OFFSET, end + OFFSET)
    return ranges


def body_end(entries, ranges):
    """正文最后一页 = 最后一个单元之后、Revision/附录之前。"""
    if not ranges:
        return None
    last_unit_start = max(start for start, _ in ranges.values())
    later = [p + OFFSET - 1 for title, p in entries
             if p + OFFSET > last_unit_start and not re.match(r"^Unit\s+\d+", title, re.I)]
    return min(later) if later else last_unit_start + 11


def page_blocks(page):
    """按阅读顺序合并被拆成多块的长句。"""
    raw = [clean_text(b[4]).strip() for b in page.get_text("blocks", sort=True) if b[4].strip()]
    out, buf = [], ""

    def ends_with_cont(text):
        words = re.findall(r"[A-Za-z']+", text.lower())
        return bool(words) and words[-1] in CONT_WORDS

    for text in raw:
        text = " ".join(line.strip() for line in text.split("\n") if line.strip())
        # 下一行小写或上一行停在虚词上，视为同一句被拆行；板块标题不参与拼接
        if buf and not HEADER_RE.match(buf) and (
            re.match(r"^[a-z,.;:!?)]", text) or ends_with_cont(buf)
        ):
            buf = f"{buf} {text}"
        elif buf:
            out.append(buf)
            buf = text
        else:
            buf = text
        if SENT_END_RE.search(buf):
            out.append(buf)
            buf = ""
    if buf:
        out.append(buf)
    return out


def is_instruction(sentence):
    """Match, say and act. 这类板块指令：多个祈使动词加连接词。"""
    tokens = re.findall(r"[A-Za-z']+", sentence.lower())
    verbs = [t for t in tokens if t in INSTR_VERBS]
    rest = [t for t in tokens if t not in INSTR_VERBS]
    return len(verbs) >= 2 and all(t in INSTR_FILLER for t in rest)


def clean_sentence(sentence):
    s = sentence.strip()
    # 成对包裹的引号去掉，只留句子本身
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"' and s.count('"') == 2:
        s = s[1:-1].strip()
    s = re.sub(r"^\d+[.)]\s*", "", s)
    s = re.sub(r"^(?:\([^)]{1,4}\)\s*)+", "", s)
    s = SPEAKER_RE.sub("", s)
    # 标题块与正文粘连时，去掉开头的大写标题词
    s = re.sub(r"^[A-Z]{3,}\s+(?=[A-Z][a-z])", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    # 对白跨句时开引号可能没有闭合，去掉孤立引号再判断
    if s.count('"') % 2 and s.startswith('"'):
        s = s[1:].strip()
    if s.count('"') % 2:
        return None
    if not SENT_SHAPE_RE.match(s):
        return None
    if CJK_RE.search(s) or BAD_CONTAINS_RE.search(s) or HEADER_RE.match(s):
        return None
    if is_instruction(s) or MID_VERB_RE.search(s) or MID_CAP_RE.search(s):
        return None
    words = s.split()
    if not 2 <= len(words) <= 16:
        return None
    return s


def sentences_of(page):
    out = []
    for block in page_blocks(page):
        for part in re.findall(r'.+?[.!?]["\')\]]?(?=\s|$)', block):
            # 连续空格或下划线是填空横线，句子缺词，直接跳过
            if re.search(r"_{2,}|\s{3,}", part):
                continue
            s = clean_sentence(part)
            if s:
                out.append(s)
    return out


def variants(text):
    """词形变化候选；含空格、连字符或省略号的词只按原形匹配。"""
    t = text.lower().strip()
    if " " in t or "-" in t or "…" in t or "..." in t:
        return [t]
    out = [t]
    if t.endswith("y"):
        out.append(t[:-1] + "ies")
    out += [t + "s", t + "es", t + "ed", t + "ing", t + "er", t + "est"]
    if t.endswith("e"):
        out += [t + "d", t[:-1] + "ing"]
    return list(dict.fromkeys(out))


def search_text(text):
    """去掉 "first (1st)" 这类括号注释，只留可检索的词形。"""
    return re.sub(r"\s*\([^)]*\)", "", text).strip().lower()


def word_pattern(variant):
    if "…" in variant or "..." in variant:
        # "have … class" 这类省略词条，中间允许 1-3 个单词
        parts = re.split(r"\s*(?:…|\.\.\.)\s*", variant)
        body = r" [a-z]+(?: [a-z]+){0,3} ".join(re.escape(p) for p in parts)
        return re.compile(r"(?<![a-z])" + body + r"(?![a-z])")
    return re.compile(r"(?<![a-z])" + re.escape(variant) + r"(?![a-z])")


def main():
    index = json.load(open(INDEX, encoding="utf-8"))
    words = index["words"]
    paths = {}
    for path in glob.glob(os.path.join(PDF_DIR, "*.pdf")):
        bid = book_id(os.path.basename(path))
        if bid:
            paths[bid] = path
    if len(paths) != 8:
        raise SystemExit(f"[失败] 只找到 {len(paths)} 本教材 PDF，期望 8 本")

    corpus, ranges_by_book = {}, {}
    for bid in sorted(paths):
        doc = pymupdf.open(paths[bid])
        entries = parse_contents(doc)
        ranges = unit_ranges(entries)
        # 5B 有 6 个单元，6B 只有 4 个，期望数量从已生成的教材数据取
        book_file = os.path.join(ROOT, "src", "data", "books", f"{bid}.json")
        expected = len(json.load(open(book_file, encoding="utf-8"))["units"])
        if len(ranges) != expected:
            raise SystemExit(f"[失败] {bid} 目录解析出 {len(ranges)} 个单元，期望 {expected} 个")
        end = body_end(entries, ranges)
        start = min(s for s, _ in ranges.values())
        items = []
        for pno in range(start - 1, end):
            for s in sentences_of(doc[pno]):
                items.append((pno + 1, s))
        corpus[bid] = items
        ranges_by_book[bid] = ranges
        print(f"[语料] {bid} 正文 p{start}-{end}，候选句 {len(items)}")

    def score(word, bid, page, sentence, variant_index):
        unit_starts = []
        for uid in word["units"]:
            if not uid.startswith(bid + "-"):
                continue
            no = int(uid.split("-U")[1])
            rng = ranges_by_book[bid].get(no)
            if rng and rng[0] <= page <= rng[1]:
                unit_starts.append(rng[0])
        tier = 0 if unit_starts else (1 if any(u.startswith(bid + "-") for u in word["units"]) else 2)
        anchor = min(unit_starts) if unit_starts else page
        odd_caps = bool(re.search(r"[a-z], [A-Z]", sentence))
        return (tier, variant_index > 0, odd_caps, abs(len(sentence.split()) - 7), page - anchor, len(sentence))

    result, missing = {}, []
    for w in words:
        w["_pats"] = [word_pattern(v) for v in variants(search_text(w["text"]))]
        best = None
        for bid, items in corpus.items():
            for page, s in items:
                low = s.lower()
                for vi, pat in enumerate(w["_pats"]):
                    if pat.search(low):
                        key = score(w, bid, page, s, vi)
                        if best is None or key < best[0]:
                            best = (key, bid, page, s)
                        break
        if best:
            _, bid, page, s = best
            result[w["id"]] = {"en": s, "book": bid, "page": page}
        else:
            missing.append(w["text"])

    for w in words:
        w.pop("_pats", None)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(result.items())), f, ensure_ascii=False, indent=1)
        f.write("\n")

    hit = len(result)
    print(f"[完成] 命中 {hit}/{len(words)}（{hit / len(words) * 100:.1f}%），缺失 {len(missing)} 个")
    if missing:
        print("[缺失] " + "、".join(missing))


if __name__ == "__main__":
    sys.exit(main())
