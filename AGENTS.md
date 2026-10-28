# AGENTS.md · 共享和弦小程序

你在为微信小程序「共享和弦」写代码。开工前先读 `plan/README.md`，再读当前任务卡（`plan/05-任务卡.md`）里点名的章节。
`plan/` 是唯一需求来源；仓库里其他旧文档只作背景，和 `plan/` 冲突时以 `plan/` 为准。

## 项目一句话

用户填一个称呼 → 在「小电视」上抽取一份专属邀请函 → 打开信封，循环播放「随机画面 × 随机音乐」的预合成短片，称呼浮在画面上。
本期是**无后端 Demo**，目标是跑通提审上架。

## 工作方式

1. 一次只做一张任务卡。开工前在回复里用 3–5 条写出实现计划，然后直接实现。
2. 只改该卡「允许修改」列出的文件。确实需要改别的文件时，先停下来说明原因。
3. 方案没写清楚、或方案和代码现状冲突时，不要猜：停下来，给出 2 个选项和你的推荐，等人决定。
4. 新增依赖、改技术栈、改目录结构之前，先停下来说明理由。

## 技术栈（不可更改）

- 原生微信小程序 + TypeScript（开发者工具 `useCompilerPlugins: ["typescript"]` 编译）。基础库最低 3.0.0。
- 不用任何框架（Taro、uni-app、mpx 等）、UI 组件库、运行时 npm 包；`miniprogram/` 里不能出现 `node_modules` 或 `miniprogram_npm`。
- 开发依赖只用 `package.json` 里已有的：typescript、vitest、tsx、miniprogram-api-typings、@types/node。
- 素材合成用系统命令 `ffmpeg` / `ffprobe`（`child_process.spawn` 调用），不用 ffmpeg 的 npm 封装包。

## 目录约定

```
.
├─ AGENTS.md · package.json · tsconfig.json · tsconfig.node.json · vitest.config.ts · project.config.json
├─ plan/                    需求、规格、任务卡（只读）
├─ miniprogram/             小程序代码（开发者工具导入仓库根目录）
│  ├─ app.ts · app.json · app.wxss · sitemap.json
│  ├─ config.ts             交互时长与开关（不放时间轴常量）
│  ├─ core/                 纯函数 + 单元测试，不碰 wx
│  ├─ services/             wx API 的薄封装：store.ts · privacy.ts · nav.ts
│  ├─ components/           tv/ · burst/ · envelope/
│  ├─ pages/                login/ · draw/ · invitation/ · legal/
│  ├─ data/manifest.ts      素材清单（脚本生成，禁止手改）
│  └─ assets/               小图标、分享图（总量 ≤ 300KB）
├─ scripts/                 Node 脚本：assets.ts · check-words.ts · precheck.ts · lib/
├─ tests/                   单元测试 *.test.ts；集成测试 *.int.test.ts
├─ assets-src/library.json  素材登记表（音视频原文件不进 git）
├─ review/审核备注.md
└─ 版本记录.md
```

## 硬规则

1. **Demo 不做后端**：不用 `wx.request`、`wx.uploadFile`、`wx.downloadFile`、`wx.connectSocket`、`wx.login`、`wx.cloud`；代码里不出现服务器地址。视频只通过 `<video src>` 播放 `data/manifest.ts` 里的 https 地址。
2. **唯一的隐私相关能力是 `<input type="nickname">`**。不调用其他隐私接口（`getUserProfile`、`getUserInfo`、相册、位置、剪贴板、手机号等）。
3. **界面文字只来自 `core/copy.ts`**：页面把 `COPY` 放进 data，在 wxml 里用 `{{copy.组.键}}`；带变量的句子在 ts 里用 `t()` / `fill()` 拼好再 setData。`pages/` 和 `components/` 的 `.ts`、`.wxml` 里不出现中文字符（注释除外，`console` 日志用英文）。页面标题写在页面 `.json` 的 `navigationBarTitleText`（唯一例外）。
4. **素材数据只来自 `miniprogram/data/manifest.ts`**，它由 `npm run assets -- manifest` 生成，禁止手改。
5. **时间轴常量只写在 `core/timeline.ts`**（淡入、淡出、静息时长和时长上下限）。页面、组件、脚本要用就 import，不另写数字。
6. **`core/` 是纯函数**：不引用 `wx`、`getApp`、`Page`、`Component`；不直接调用 `Date.now()`、`Math.random()`（时间、随机数由参数传入）；每个模块都有单元测试。
7. **有声播放必须由用户动作触发**（点「点击抽取」或点信封）：不给有声 `<video>` 加 `autoplay`，用 `VideoContext.play()`。
8. **转发**：只在 login、draw、invitation 三个页面实现 `onShareAppMessage`；`path` 一律 `/pages/login/index`；标题和图片里不含用户称呼。legal 页不实现。
9. **不改测试迁就代码**：不要修改或删除已有测试来让测试通过。测试期望和 `plan/` 不一致时停下来报告。
10. **不提交**密钥、AppSecret、COS SecretId/SecretKey、真实用户数据、音视频原文件、`work/`、`dist-assets/`。
11. 提交前运行 `npm run check:words`：禁用词（`scripts/forbidden-words.txt`）不能出现在文案、协议、清单、审核备注、wxml 和页面 json 里。

## 代码风格

- TypeScript `strict`；不用 `any`（需要时用 `unknown` 再收窄）；不用 `@ts-ignore`。
- 2 空格缩进、单引号、不加分号；文件名小写加短横线；变量和函数 camelCase；常量 UPPER_SNAKE_CASE。
- 样式单位用 rpx；颜色、字号用 `app.wxss` 里的 CSS 变量（`--sc-*`），不在页面里写死色值（`manifest` 里的文字颜色除外）。
- 函数短小、命名直白；注释用中文，只解释「为什么」。
- 页面和组件的 ts 里只做「取数据 → 调 core → setData」，计算逻辑放 `core/`。

## 常用命令

```bash
npm run typecheck              # 类型检查（小程序 + Node 两套配置）
npm test                       # 单元测试；没有 ffmpeg 时集成测试自动跳过
npm run check:words            # 禁用词与硬编码中文检查
npm run assets -- <命令>       # 素材流水线：check / normalize / render / manifest / sample
npm run precheck               # 提审前检查（C11 之后可用）
```

## 完成定义（每张卡结束时按此汇报）

1. **改动文件列表**：新增 / 修改 / 删除。
2. **命令结果**：`npm run typecheck`、`npm test`、`npm run check:words` 的输出结尾，三条都必须通过。
3. **人工验收**：把任务卡里的「人工验收」步骤原样列出，提醒人类在微信开发者工具或真机上执行（你无法运行开发者工具）。
4. **偏离方案**：和 `plan/` 不一致的地方及原因；没有就写「无」。
5. **遗留问题**：没做完或需要人决定的事；没有就写「无」。
