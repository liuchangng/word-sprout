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
