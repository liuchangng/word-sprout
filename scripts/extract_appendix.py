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
    # 目录页也含 "Appendix 3  Words in each unit"，取最后一次出现即附录正文
    hits = [i for i, t in enumerate(texts) if "Words in each unit" in t]
    start = hits[-1] if hits else None
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
