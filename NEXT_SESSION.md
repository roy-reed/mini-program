# 下次继续：方案 v1.1 收尾交接

更新日期：2026-10-18（北京时间）。这是按用户“额度没有了，收束当前工作，方便下次继续”要求保存的阶段草稿。**当前任务仍是完成可供实现模型执行的项目方案；尚未开始应用开发。**

## 1. 仓库与恢复位置

- 仓库：`roy-reed/mini-program`。
- v1.0 方案已通过 [PR #1](https://github.com/roy-reed/mini-program/pull/1) 合并；本次基于主分支提交 `e334324641b61e5a2d781acf0286ce302f38ff54`。
- v1.1 阶段草稿分支：`docs/implementation-guide-checkpoint`。继续时先确认该分支是否已合并、是否有后续提交，保留用户的新修改。
- 本次只补充文档、机器契约和方案检查脚本；不包含可运行的小程序、API、Worker、管理端或数据库迁移。
- 原有 LICENSE、流程截图和两份 drawio 文件保留。

## 2. 必须保持的用户目标

产品是微信原生小程序：输入称呼，选择专辑活动，随机抽取预制副歌与背景组合，生成写有“诚邀 XXX 收听”的真实音乐视频邀请函。再次进入可查看原邀请函；改名不重新抽取款式。

方案需要清晰到 DeepSeek V4.1 Flash、ChatGPT 5.6 Sol 等级别模型可按任务实施，覆盖开发环境、接口、数据库、真实视频、微信真机、隐私授权、体验版、提审、发布和运维。不要把网页演示或开发者工具编译成功当作微信小程序交付。

默认边界：TypeScript＋WXML＋WXSS；Fastify API＋PostgreSQL＋独立 FFmpeg Worker＋私有 COS；Vue 管理端；每用户每活动一次抽取；改名需用户主动重生成；真实 MP4；首版无付费抽奖、用户上传或声音克隆。账号主体、AppID、云配置和正式版权素材仍待项目方提供。

## 3. 已保存的新增草稿

| 内容 | 入口 | 当前程度 |
| --- | --- | --- |
| 模型执行规则、阅读顺序和状态 | [AGENTS.md](AGENTS.md)、[AI_START_HERE.md](AI_START_HERE.md)、[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | 已写；应用任务 P00–P15 均未开始 |
| 工程目录、构建和脚本约定 | [工程实施蓝图](docs/08-engineering-blueprint.md) | 脚本是未来实现要求，尚无应用工程 |
| 微信环境、调试、真机、生命周期 | [开发手册](docs/09-wechat-development.md) | 已写预防性指导，尚无本项目真机证据 |
| 主体、备案、体验版、提审、发布 | [发布手册](docs/10-wechat-release.md) | 已写全流程检查与材料模板，未登录平台操作 |
| 分阶段实施与故障交接 | [任务卡](docs/11-ai-task-cards.md)、[排障手册](docs/12-troubleshooting.md) | 16 张任务卡；排障建议不能说成实际项目经验 |
| 迁移、事务、权限与管理会话 | [数据库实施约定](docs/13-database-implementation.md) | 设计草稿，见下面的待修正项 |
| HTTP 和配置契约 | [openapi.json](specs/openapi.json)、[campaign.schema.json](specs/campaign.schema.json) | 43 个操作、52 个数据结构；业务覆盖仍待检查 |
| 请求响应示例与验收场景 | [api-examples.json](specs/api-examples.json)、[acceptance-cases.json](specs/acceptance-cases.json) | 6 个示例、26 个计划场景，场景尚未转成应用测试 |
| 可实际运行的方案检查 | [check-plan.mjs](scripts/check-plan.mjs) | 已执行通过；只验证方案文件 |

## 4. 下次首先完成的工作：方案一致性收尾

按以下顺序推进；完成前不要直接开始 P01 生成应用代码。

1. **统一文档入口和版本。** README 当前保留 v1.0 导航，PROJECT_PLAN 与 docs/01–07 尚未整体同步新增实施包。更新导航、版本、任务映射和交付边界，保持产品规则一致。
2. **统一自然语言接口与 OpenAPI。** 对照 docs/04 的登录字段、登录状态码、PATCH /me 幂等要求、Invitation 响应、公开接口、管理鉴权和失败任务取消语义。消除旧示例与新契约的差异；不要只声明新文件优先而留下矛盾。
3. **修正管理会话的 CSRF 恢复设计。** docs/13 目前写“仅存 CSRF token hash”，又让会话查询返回 token；哈希无法还原令牌。明确采用可重建的 HMAC 派生方案或其他完整方案，规定独立密钥、会话绑定、轮换和校验，再同步契约与环境变量。
4. **明确管理端部署源与鉴权配置。** SameSite=Lax 与独立管理域/API 域的关系尚未落实。优先评估同源反向代理 `/api/v1/admin`；写清 Cookie、Origin、CSRF、CORS 和生产域名规则。同步 docs/03、docs/04、docs/08 与 docs/13 的独立管理员密码＋TOTP方案及所需密钥。
5. **检查管理端实际操作能否只靠现有 API 完成。** 核对素材与款式的列表/查询/选择接口、封面与收听入口的活动字段、素材审核和发布校验。当前 OpenAPI 的 43 个操作不代表所有后台需求均已覆盖；补齐必要契约及示例、验收场景。
6. **把官方依据并回来源文档。** 下方保留本轮已经查阅的来源。docs/07 尚未更新这些信息；平台变化或无法直接核实的内容继续标注，不宣称平台审核时间、类目或资质已确定。
7. **完成一次方案交叉检查。** 跑下方脚本，检查任务依赖、接口/数据/页面对应关系及 Markdown 链接。P02 仍须使用维护中的标准工具验证完整 OpenAPI/JSON Schema，并实现真实测试；不要把现有轻量检查器说成完整标准验证器。
8. **再决定进入实现。** 方案收尾完成后更新本交接页、AI_START_HERE 与实施状态，明确后续从 P00/P01 开始。用户当前原始需求是项目方案，应用实现范围以用户后续授权为准。

## 5. 已有验证与边界

在仓库根目录执行：

```sh
node scripts/check-plan.mjs
```

已有检查通过：JSON 引用、operationId、路径参数、管理写操作 CSRF 声明、6 个响应示例、12 个活动组合及关联、4 个负向检查、26 个计划验收场景引用、Markdown 相对链接与代码围栏。示例活动维持 `draft`、`publication.ready=false`，不能直接发布。

检查器无额外依赖，只覆盖本方案使用的 JSON Schema 子集。没有安装完整 OpenAPI 标准验证器；没有执行应用测试、数据库事务测试、真实业务视频渲染、AppID 联调、真机保存分享、微信提审或生产发布。

## 6. 已查阅的官方依据，供下次整合

| 来源 | 已用于判断的范围 |
| --- | --- |
| [微信官方 API 类型仓库](https://github.com/wechat-miniprogram/api-typings)、[API 定义](https://raw.githubusercontent.com/wechat-miniprogram/api-typings/master/types/wx/lib.wx.api.d.ts)、[Page 定义](https://raw.githubusercontent.com/wechat-miniprogram/api-typings/master/types/wx/lib.wx.page.d.ts) | 相册保存使用本地 MP4 路径、隐私授权辅助 API、系统授权状态、页面生命周期和分享回调；类型定义不能替代真机验证 |
| [工信部 APP 备案通知](https://www.miit.gov.cn/jgsj/xgj/wjfb/art/2023/art_dd783a581c9644a4aee10afa582811db.html)、[官方解读](https://www.miit.gov.cn/zwgk/zcjd/art/2023/art_39b4f1acc36745b98478e0ec3e07128d.html) | 备案与上线流程；不据此臆测项目实际类目或审批结论 |
| [腾讯微搭发布流程](https://cloud.tencent.com/document/product/1301/55140) | 上传、体验、审核、发布的阶段区别；页面属于微搭产品，不直接套用其后台界面到原生开发 |
| [Node.js 发布状态](https://nodejs.org/en/about/previous-releases)、[Fastify LTS](https://fastify.dev/docs/latest/Reference/LTS/) | Node 22 与 Fastify 5 的选型依据；实际补丁版本在 P01 锁定 |
| [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0)、[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation) | 契约格式依据 |
| [OWASP 密码存储](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)、[CSRF 防护](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | 独立管理身份、Argon2id、Cookie 与 CSRF 设计依据；本项目设计仍有上面的待修正项 |

直接读取微信开发文档部分页面此前受访问限制。当前控制台要求、服务类目、隐私声明、基础库行为和审核材料，仍需在有权限的微信后台与真机阶段核实。

## 7. 下次可直接发送的提示

```text
继续 roy-reed/mini-program 项目方案。
先检查 docs/implementation-guide-checkpoint 分支及关联草稿 PR 是否已有新提交或合并，保留用户修改。
读取 NEXT_SESSION.md、AGENTS.md、AI_START_HERE.md 和 IMPLEMENTATION_STATUS.md。
先完成 NEXT_SESSION.md 第 4 节的方案一致性收尾，特别是管理会话 CSRF、同源部署、后台接口覆盖与旧文档同步。
保持微信原生小程序、一次抽取、改名不重抽、真实 MP4 的约束，覆盖真机和上架全流程。
运行方案检查并诚实说明未验证部分；更新原草稿 PR 与交接文件。
本轮先完成项目方案，不直接开始应用开发。
```
