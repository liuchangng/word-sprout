# 词芽 Word Sprout 设计文档

- 日期：2026-10-28
- 状态：已确认，待实现
- 位置：`E:\workspace\html\english-learning\word-sprout`
- 参考项目：`E:\workspace\html\english-learning\word-atlas`

## 1. 背景与目标

给小学 3 到 6 年级的孩子做一个 PEP 英语教材配套的本地单词工具。孩子每天学 10 个词，学过的词在花园里从种子长成花。

现有 `word-atlas` 是雅思向的星图产品，学习引擎（FSRS 排期、会话生成、评分、本地存储、备份）已经稳定，可以复用。本项目的差别在数据模型、学习流程和视觉表达。

一句话目标：**打开就是今天要浇的 10 颗种子，学完看着它们发芽。**

### 成功标准

1. 孩子能在 30 秒内开始第一组词，不需要读说明。
2. 每天 10 分钟能走完当日计划。
3. 一周后花园里有可见的变化，孩子愿意再打开一次。
4. 教材词表完整覆盖 8 册，无缺词、无重复学习。

## 2. 非目标

- 不做通用词典，不覆盖非 PEP 教材。
- 不做账号、云同步、社交、排行榜。
- 不做付费、广告、虚拟货币、抽卡。
- 不做打字练习、环境声、WebGL 星图。
- 不做真人录音音频，只用浏览器 TTS。
- 不做教师端和家长报告。

## 3. 用户与场景

**主要用户**：小学 3 到 6 年级学生，能独立使用平板或电脑，识字量足够读中文界面。

**次要用户**：家长，负责首次设置（选册、设目标）和备份。

**典型场景**：

1. 放学后打开，首页显示今日 10 词，点开始，8 分钟学完，看到种子发芽。
2. 周末想复习某一单元，进花圃，点单元，逐词看词卡。
3. 换设备时导出备份，在新设备导入，进度完整恢复。

## 4. 数据源与版本

数据来自 8 本人教版 PEP 英语教材 PDF，附录 `Words in each unit` 有文字层，可直接解析，不需要 OCR。

| 册 | id | 状态 | 处理 |
|---|---|---|---|
| 三年级上册 | 3A | 2024 新版 | 直接解析 |
| 三年级下册 | 3B | 2024 新版 | 直接解析 |
| 四年级上册 | 4A | 2024 新版 | 直接解析 |
| 四年级下册 | 4B | 2024 新版 | 直接解析 |
| 五年级上册 | 5A | 2024 新版 | 直接解析 |
| 五年级下册 | 5B | 2013 旧版 | 标注旧版，后续单本替换 |
| 六年级上册 | 6A | 2024 新版 | 直接解析 |
| 六年级下册 | 6B | 2013 旧版 | 标注旧版，后续单本替换 |

解析结果：981 条词条，去重后 866 个词，104 个词跨册重复，46 个教学单元（六下 4 个单元）。

新版五下已发布（2025 春，6 个单元：Following the rules、Our community、Life in different seasons、My hometown、Travelling around、Making a travel plan），但当前没有 PDF。新版六下官方资源页尚未上线。

**决策**：第一版用现有 PDF 建库，5B、6B 标 `edition: 2013` 并在界面显示“旧版”徽标。数据结构按单本版本号设计，后续拿到新版只替换该本 JSON，不动学习进度。

### 版权

教材词表版权属人民教育出版社。项目定位本地个人学习使用，不公开发布词库，数据文件不进公开仓库。

## 5. 信息架构

| 路由 | 页面 | 作用 |
|---|---|---|
| `/` | 花园 | 今日任务、当前花圃、总进度、连续天数 |
| `/garden` | 花圃 | 按册、按单元浏览开花情况 |
| `/learn` | 学习 | 全屏会话，无底部导航 |
| `/word/:id` | 词卡 | 单词详情与出处 |
| `/me` | 我的 | 目标、发音、备份、关于 |

底部导航三项：花园、花圃、我的。词卡不占导航位，从花圃的点词列表进入。学习页独立全屏，不带导航。

首次进入走一次极简引导：选当前册、选每日目标，两步，可跳过（默认 3A、10 词）。

## 6. 学习闭环

### 6.1 每日计划

```ts
interface PlanItem { wordId: string; kind: "new" | "review" }

function buildSession(now: number, save: SaveFile, catalog: Catalog, goal: number): PlanItem[]
```

规则：

1. 到期复习词按 `due` 升序，最多占 `ceil(goal * 0.6)`。
2. 剩余名额补新词，按当前册单元顺序推进，跳过已学过的词。
3. 当前册学完自动切到下一册，并在花园页提示。
4. 总数上限 `goal`。到期词超过上限时，只取最超期的，其余留到下次。
5. 新词不足时允许会话变短，不补旧词。

### 6.2 单卡流程

四步，儿童向，全部可点击，不要求键盘输入：

1. **看图猜词**：OpenMoji 大图标 + 自动发音，孩子先听。
2. **选中文**：4 选 1，干扰项从同册词里取，同词性优先。
3. **拼一拼**：字母块点击排序，点错可撤回，不限制时间。
4. **认一认**：卡片翻面，显示音标、中文、词性、例句，两个按钮“记住了 / 有点难”。

### 6.3 评分映射

记录每张卡的首次正确率，映射到 FSRS Rating：

| 情况 | Rating |
|---|---|
| 四步全对 | Good (3) |
| 有错但最终完成 | Hard (2) |
| 两步以上出错或放弃拼写 | Again (1) |

`Again` 的词在本会话末尾再出现一次，只重复“认一认”一步。`Hard` 不重复。

FSRS 参数沿用 `word-atlas/src/store/srs.ts`：`request_retention 0.9`、`learning_steps ["1m","10m"]`、`relearning_steps ["10m"]`、开启 fuzz 和 short term。不修改算法。

### 6.4 会话结束

- 展示本次新长的芽数量、复习词数量、正确率。
- 今日进度环填满时有开花动效。
- 一句花园寄语，从固定文案池随机。
- 按钮：回花园 / 再来一组（仅当还有到期词）。

## 7. 花园进度

### 7.1 阶段判定

全部由 `CardState` 实时推导，不额外存储：

```ts
type Stage = 0 | 1 | 2 | 3; // 种子 / 嫩芽 / 叶 / 花

function stageOf(card: CardState | undefined): Stage {
  if (!card || card.reps === 0) return 0;   // 种子
  if (card.reps >= 2 && card.sd >= 1) {
    return card.s >= 21 ? 3 : 2;            // 花 / 叶
  }
  return 1;                                  // 嫩芽
}
```

- `reps`：复习次数
- `sd`：距下次复习的天数
- `s`：FSRS 记忆稳定度（天），21 天视为开花

### 7.2 三层结构

| 层级 | 对应 | 展示 |
|---|---|---|
| 词 | 一个 word id | 一株植物，4 个阶段 |
| 花圃 | 一个教学单元 | 6 到 12 个格子的苗床，显示开花率 |
| 花园 | 一册教材 | 6 块花圃，显示总开花数 |

跨册重复词只占一个进度，但会在它出现的每个单元格子里同步点亮。

### 7.3 首页指标

- 今日进度环：已完成 / 今日目标
- 连续学习天数（自然日，断一天归零）
- 当前花园开花数 / 总数
- 当前单元名与下一颗种子

不做排行榜、不做虚拟货币、不做抽卡。

## 8. 视觉系统

明亮绘本花园风。

```
奶油纸  #FDF8EE   背景
叶子绿  #4E9B5F   主色、进度
天空蓝  #7FB8DC   次色、链接
阳光黄  #F5C542   奖励、开花
土壤棕  #A9744F   分隔、未学
墨色    #3D3A34   正文
```

- 大圆角卡片 20 到 28px，柔和投影，不用硬边框。
- 字体：`Nunito` 打头，中文回退 `PingFang SC` / `Microsoft YaHei`。
- 动效克制：卡片翻面、种子发芽（scale + 轻微旋转）、进度环填充。
- 全部动效遵循 `prefers-reduced-motion`，设置页也可强制关闭。
- 图标：OpenMoji SVG 子集（CC BY-SA 4.0），按词义映射，缺图回退字母积木块。
- 发音：Web Speech API，`en-GB` 优先，可切 `en-US`，语速 0.9，可调 0.7 到 1.2。
- 触控目标最小 44px，焦点可见，反馈用 `aria-live`。

## 9. 数据模型

教材层在构建期生成，运行期只读。

```ts
type BookId = "3A" | "3B" | "4A" | "4B" | "5A" | "5B" | "6A" | "6B";

interface Book {
  id: BookId;
  grade: 3 | 4 | 5 | 6;
  term: "上" | "下";
  edition: 2024 | 2013;
  units: Unit[];
}

interface Unit {
  id: string;          // "5B-U1"
  no: number;
  title: string;       // 教材英文单元名
  titleZh: string;
  wordIds: string[];
}

interface Word {
  id: string;          // 规范化文本，如 "w:apple"
  text: string;
  ipa: string;         // 可为空串
  zh: string;
  pos?: string;
  core: boolean;       // 2022 课标二级词，教材带 * 标记
  units: string[];     // 出现的全部单元，跨册保留
  emoji?: string;      // OpenMoji 文件名，无则不显示
  example?: { en: string; zh: string; src: "textbook" | "tatoeba" };
}
```

索引文件 `src/data/index.json` 只含 `id, text, zh, ipa, core, units, emoji`，用于列表与检索；完整词条按册拆分为 `src/data/books/{id}.json`，按需加载。

### 9.1 去重规则

规范化：小写、去首尾空白、连续空格压成一个、保留撇号和连字符。规范化结果作为 id 主体。

`apple` 出现在 3A 和 4A，只有一个 word id，`units: ["3A-U4","4A-U2"]`。学习进度记在 word id 上，两个单元格子同时推进。

### 9.2 构建管线

`scripts/build-curriculum.mjs`：

1. 用 PyMuPDF 抽取每本附录页，过滤页脚、页码、注释行。
2. 按 `Unit N` 切分，逐行解析 `[*]word /ipa/ 中文 p.页码`。
3. 归一化 id，跨册合并，累加 `units`。
4. 音标：新版直接取；旧版（5B、6B）是 PUA 私有区编码，先查 `scripts/overrides/ipa.json`，再查 dictionaryapi.dev，都失败则留空。
5. 词性：从中文释义前缀推断（`n.` `v.` `adj.`），失败留空。
6. emoji：查 `scripts/emoji-map.json`（人工维护），无匹配留空。
7. 例句：优先教材原句，其次 Tatoeba 查询（限流 1 req/s，结果缓存到 `scripts/cache/tatoeba.json`），都无则省略。
8. 输出 `src/data/books/*.json` 与 `src/data/index.json`，并打印统计（总词条、唯一词、跨册重复、缺音标数、缺图数）。

人工覆盖文件优先于网络结果，保证可重复构建。

## 10. 技术架构

```
word-sprout/
  src/
    data/
      index.json
      books/3A.json ... 6B.json
    store/
      store.ts        本地存储、设置、备份
      srs.ts          FSRS 排期（复用）
      session.ts      今日计划、会话、评分
      garden.ts       阶段推导、单元与全书进度
      stats.ts        连续天数、每日统计
    pages/
      Today.tsx  Garden.tsx  Learn.tsx  Word.tsx  Me.tsx  Onboarding.tsx
    ui/
      Sprout.tsx  GardenBed.tsx  Ring.tsx  Sheet.tsx  Toast.tsx  Speak.tsx  Nav.tsx
    lib/
      router.ts  speech.ts  format.ts  random.ts
    styles/app.css
  scripts/
    build-curriculum.mjs
    emoji-map.json
    overrides/ipa.json
  public/emoji/*.svg
  docs/superpowers/specs/
```

栈：Vite + React 19 + TypeScript + ts-fsrs + Vitest。纯静态，无后端。

复用：`srs.ts` 原样搬；`store.ts` 的版本化 schema、导入导出、异常兜底搬过来改字段；`router.ts` 的 hash 路由搬；`Sheet`、`Toast`、`Ring`、`Speak` 重画但沿用结构。

不复用：`galaxy/*`、`lib/typing.ts`、`ui/Ambience.tsx`、雅思 `data.ts` 与 CEFR、话题体系。

## 11. 存储结构

`localStorage` 单键 `word-sprout:v1`。

```ts
interface SaveFile {
  v: 1;
  createdAt: number;
  updatedAt: number;
  settings: Settings;
  cards: Record<string, CardState>;      // word id -> FSRS card
  stats: {
    days: Record<string, DayStat>;       // "2026-10-28" -> 当日统计
    streak: number;
    lastDay: string | null;
  };
}

interface Settings {
  dailyGoal: 5 | 10 | 15 | 20;
  activeBook: BookId;
  accent: "uk" | "us";
  rate: number;                          // 0.7 - 1.2
  motion: "system" | "off";
}

interface DayStat {
  learned: number;
  reviewed: number;
  correct: number;
  total: number;
}
```

- 版本迁移：`v` 不匹配时尝试逐级迁移，失败则保留原数据并新建，提示用户导出旧备份。
- 导入：校验 `v`、`cards` 结构、日期范围，非法则拒绝并保留现有数据。
- 导出：`word-sprout-backup-YYYY-MM-DD.json`，含全部进度与设置。
- 存储写入失败（隐私模式、配额满）时降级为内存态，顶部提示“进度不会保存”。

## 12. 错误与边界

| 情况 | 处理 |
|---|---|
| 浏览器无英文语音 | 隐藏喇叭按钮，词卡显示文字提示 |
| 浏览器不支持 `speechSynthesis` | 同上，不阻塞学习 |
| 本地存储不可用 | 内存态运行，明确提示不保存 |
| 导入文件损坏 | 拒绝，保留现有数据，Toast 说明 |
| 词条缺音标 | 隐藏音标行，不留空白占位 |
| 词条缺图 | 显示首字母积木块 |
| 词条缺例句 | 只显示词义，不编造 |
| 当前册学完 | 自动切下一册并提示，全部学完显示完成态 |
| 跨册重复词 | 只学一次，多处同步点亮 |
| 用户改动系统时间 | 以本地日期为准，检测到时间倒退时只更新 `lastDay`，不清进度 |
| 会话中途退出 | 已评分的卡保留，未评分的丢弃，下次重新生成 |

## 13. 测试

Vitest 覆盖逻辑层，不测像素。

- `srs.test.ts`：沿用 word-atlas 用例，验证 Rating 到排期的映射。
- `session.test.ts`：到期优先与 60% 上限、新词补位、册切换、重复词不重复出、新词不足时会话变短、上限截断。
- `garden.test.ts`：四个阶段阈值、跨册重复词同步点亮、单元与全书进度。
- `stats.test.ts`：连续天数跨日累加、断档归零、同日多次会话合并。
- `store.test.ts`：schema 迁移、导入校验、损坏数据拒绝。

手工验收：Chrome 桌面、iPad Safari、iPhone Safari 各走一遍完整闭环。

## 14. 验收标准

1. 8 本书、46 个单元全部可浏览，词条数与解析统计一致（981 条 / 866 唯一词）。
2. 新用户首次进入 30 秒内开始第一组 10 个词。
3. 完成一组后对应单元格子从种子变芽，刷新后状态保留。
4. 跨册重复词只学一次，多个单元的格子同步点亮。
5. 导出备份再导入，进度与设置完全一致。
6. 断网后除发音外全部功能可用。
7. 五个逻辑层测试文件全部通过。
8. 移动端 375px 宽无横向滚动，触控目标不小于 44px。

## 15. 里程碑

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| M1 | 数据管线 | 8 本 JSON 生成，统计与解析结果一致，人工抽检 20 词无误 |
| M2 | 骨架与引擎 | 路由、存储、FSRS、会话生成可用，逻辑测试通过 |
| M3 | 学习流程 | 四步卡片、评分、复习队列、会话总结可跑通 |
| M4 | 花园与花圃 | 阶段推导、苗床、册切换、进度展示 |
| M5 | 词卡与我的 | 词卡详情、发音、设置、备份导入导出 |
| M6 | 打磨 | 视觉细节、响应式、动效、可访问性、全量验收 |

## 16. 风险

| 风险 | 影响 | 处理 |
|---|---|---|
| 五下、六下版本不一致 | 词表与当前课堂内容不符 | `edition` 字段 + 旧版徽标，单本可替换 |
| 旧版音标 PUA 乱码 | 音标不可读 | 覆盖文件 + dictionaryapi.dev 补齐，失败留空 |
| 词表版权 | 无法公开发布 | 本地个人使用，数据不进公开仓库 |
| 例句质量 | 孩子读到不自然句子 | 教材原句优先，Tatoeba 标注来源，缺则省略 |
| TTS 音色差异 | 部分设备发音怪 | 允许切换口音与语速，保留文字音标 |
| 866 词的 emoji 映射工作量大 | 大量缺图 | 先覆盖高频具体名词，抽象词用字母块，逐步补 |

## 17. 待定

- 新版五下 PDF 是否可提供。拿到后替换 5B，`edition` 改为 2024，学习进度不受影响。
- 新版六下发布后同样处理。
- 项目是否初始化 git 仓库（当前工作区不是 git repo）。
