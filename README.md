# 词芽 Word Sprout

小学 PEP 英语单词花园。每天学一组词，学过的词在花圃里从种子长成花。

## 开发

```bash
npm install
npm run dev
```

## 教材数据

数据来自 8 本教材 PDF 的附录词表，例句取自正文，构建产物在 `src/data`。

```bash
npm run data:extract    # 需要本机 D:\QMDownload 下有 8 本 PDF，抽取附录
npm run data:examples   # 从正文抽取例句到 scripts/.cache/examples.json
npm run data:build      # 生成 src/data/index.json 与 src/data/books/*.json
npm run data:audio      # 用 edge-tts 生成 public/audio 下的单词发音
```

例句按词所在单元优先匹配，过滤填空、指令和词表噪声。中文释义与残缺原句的人工校对写在
`scripts/overrides/examples.json`（按词 id 存 `{ en?, zh }`，`en` 为空串表示删除该词例句），
抽取时自动应用；`zh` 为空的词卡只显示英文例句。

`5B`、`6B` 只有 2013 旧版，没有新课标版本，界面显示“旧版”徽标。学习进度按词 id 保存，不受影响。

发音用 `public/audio` 里预生成的 mp3，播放失败才回退有道接口和系统语音。edge-tts 走微软的私有协议，
浏览器不能直连，所以必须用 `npm run data:audio` 先落地成静态文件；已存在的文件会跳过，可断点续跑。

## 测试

```bash
npm test
npm run build
```

## 版权

教材词表与例句版权属人民教育出版社，本项目仅用于个人学习研究，请勿用于商业用途。图标来自 OpenMoji，许可 CC BY-SA 4.0。

代码部分以 [MIT](LICENSE) 许可发布。
