"""用 edge-tts 生成单词发音，输出 public/audio/{slug}-{uk|us}.mp3。

edge-tts 走微软 Edge 的在线语音，免费且音质好，但只能在服务端或本地运行，
浏览器无法直连，所以这里预生成静态文件。已存在的文件会跳过，可断点续跑。
"""
import asyncio
import json
import os
import re
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "src", "data", "index.json")
OUT_DIR = os.path.join(ROOT, "public", "audio")
VOICES = {"uk": "en-GB-SoniaNeural", "us": "en-US-AriaNeural"}
CONCURRENCY = 4
RETRIES = 3


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


async def synth(text, voice, path, sem, done, total):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        done[0] += 1
        return
    async with sem:
        for attempt in range(1, RETRIES + 1):
            try:
                await edge_tts.Communicate(text, voice).save(path)
                break
            except Exception as exc:  # 网络抖动或限流，重试
                if attempt == RETRIES:
                    print(f"[失败] {text} ({voice}): {exc}")
                    return
                await asyncio.sleep(attempt)
    done[0] += 1
    if done[0] % 50 == 0:
        print(f"[进度] {done[0]}/{total}")


async def main():
    words = json.load(open(INDEX, encoding="utf-8"))["words"]
    texts = sorted({w["text"] for w in words})
    # 调试时限制条数：python scripts/build_audio.py 10
    if len(sys.argv) > 1:
        texts = texts[: int(sys.argv[1])]
    os.makedirs(OUT_DIR, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    done = [0]
    total = len(texts) * len(VOICES)
    print(f"[生成] {len(texts)} 个词 × {len(VOICES)} 种口音 = {total} 条")
    tasks = []
    for text in texts:
        name = slug(text)
        for accent, voice in VOICES.items():
            path = os.path.join(OUT_DIR, f"{name}-{accent}.mp3")
            tasks.append(synth(text, voice, path, sem, done, total))
    await asyncio.gather(*tasks)
    files = [f for f in os.listdir(OUT_DIR) if f.endswith(".mp3")]
    size = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in files)
    print(f"[完成] {len(files)} 个文件，共 {size / 1024 / 1024:.1f} MB")
    if len(files) < total:
        print(f"[警告] 期望 {total} 个，实际 {len(files)} 个")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
