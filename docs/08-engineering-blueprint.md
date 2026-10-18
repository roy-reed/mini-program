# 工程实施蓝图

本节将技术路线收敛为一种实现，减少模型自行选型。应用命令由 S01 及所属后续卡建立，当前尚无应用工程；只有 `node scripts/check-plan.mjs`、`node scripts/prepare-task.mjs` 和标准契约检查脚本实际存在。不要在S01建立返回假成功的未来命令。

## 1. 固定技术与模块边界

Node.js 采用仍受维护的 22.x LTS，Fastify 5.x、PostgreSQL 18、pnpm 10.x、TypeScript 5.x。Vue 3＋兼容的 Vite 用于后台；选择兼容补丁版本后将精确版本、镜像摘要和验证日期记录在 `docs/runtime-versions.md`，提交锁文件。升级主版本另开变更，不在任务中随意追逐 latest。

Node 与 Fastify 的支持范围已查阅官方资料；安装时仍执行 engines／类型／构建检查。云数据库所在地域若未提供 PostgreSQL 18，技术负责人明确改为仍受维护的兼容版本并重测，不通过忽略版本校验继续。

| 包名 | 目录 | 入口／职责 |
| --- | --- | --- |
| `@invite/miniprogram` | `apps/miniprogram` | 原生微信页面；依赖纯类型和小程序适配器 |
| `@invite/admin` | `apps/admin` | Vue 后台；仅调用管理员接口 |
| `@invite/api` | `services/api` | `src/server.ts` 启动；`src/app.ts` 创建可测试 Fastify 实例 |
| `@invite/worker` | `services/render-worker` | `src/main.ts` 常驻任务轮询；退出时不再领新任务 |
| `@invite/contracts` | `packages/contracts` | 从 OpenAPI 生成 DTO；统一状态与错误；不依赖服务端 SDK |
| `@invite/infrastructure` | `packages/infrastructure` | 仅Node服务端共享pg连接、存储适配与租约工具；禁止被小程序引用 |
| `@invite/domain` | `packages/domain` | 纯业务函数：规范化、权重区间、状态转移；不依赖微信／数据库 |

服务端TS构建采用NodeNext模块与解析，源文件相对import写.js扩展名，编译到dist后由Node运行；开发可用tsx，但生产不依赖它即时转译。小程序仍为CommonJS，不能混用tsconfig。

服务端数据库用 `pg`＋参数化 SQL；迁移文件为有序 SQL，用迁移 runner 管理版本与校验和。不在首版混用多个 ORM。测试建议 Vitest＋Fastify inject＋独立 PostgreSQL 测试库；FFmpeg 集成测试使用短测试母版。

## 2. 目录和文件职责

| 路径 | 必须存在的内容／职责 |
| --- | --- |
| 根 `package.json`、`pnpm-workspace.yaml`、锁文件 | 统一命令、workspaces、精确 packageManager；禁止各包各装一套漂移依赖 |
| `scripts/build-miniprogram.mjs` | TS→JS、静态复制、环境配置生成、禁止文件扫描；失败非零退出 |
| `apps/miniprogram/project.config.json` | `compileType=miniprogram`，`miniprogramRoot=dist/`；真实公开 AppID，不能有 AppSecret |
| `apps/miniprogram/tsconfig.json` | rootDir=src、outDir=dist、module=CommonJS、target=ES2018、strict、noEmitOnError；types 指定微信官方类型 |
| `apps/miniprogram/src/app.ts`／`.json`／`.wxss` | 启动与错误处理；注册全部页面／tabBar；全局样式 |
| `apps/miniprogram/src/pages/` | 按页面清单，每页 `.ts/.json/.wxml/.wxss` 四文件 |
| `apps/miniprogram/src/components/` | privacy-dialog、state-panel、campaign-card、invitation-player；声明 `component:true` |
| `apps/miniprogram/src/services/` | api、session、privacy、media-save、share；微信 API 适配集中管理 |
| `apps/miniprogram/src/config/generated.ts` | 构建产生公开环境配置；不允许手工写生产密钥 |
| `services/api/src/modules/` | auth、users、campaigns、invitations、shares、admin、events；route→service→repository 分层 |
| `services/api/src/adapters/` | wechat-login、moderation、object-storage、admin-auth；替身仅用于测试 |
| `services/render-worker/src/` | claim、heartbeat、render、verify、upload、finalize、cleanup 各自模块 |
| `db/migrations/` | 结构迁移；`db/seeds/` 只放明确标注的开发数据 |
| `infra/compose.dev.yml` | 开发 PostgreSQL；测试 COS 采用接口替身，真机阶段连接专用测试桶 |
| `infra/compose.prod.yml` | API、Worker、反向代理；生产数据库外置，不默认暴露 5432 |
| `tests/` | contracts、integration、media、fixtures；真机结果另放 `docs/evidence/` |

首版小程序禁止运行时引入服务端 workspace 包。`packages/contracts` 只以 `import type` 进入小程序；必须运行的纯函数由构建脚本生成到 `src/generated/` 或采用已验证的小程序兼容打包，不能在 dist 保留 `@invite/*`／`node:*` 裸导入。S01 默认采用前者并校验输出。

## 3. 小程序构建的唯一约定

开发者工具只导入 `apps/miniprogram`；编译根目录由 `project.config.json` 指向 `dist/`。Node 脚本负责 TypeScript 转换，IDE 不再二次执行 TS 编译。构建按以下顺序：

1. 校验选定环境及公开 AppID、API 域名；生产禁止 localhost、测试 mock、占位字段。
2. 清理 dist，生成 `src/config/generated.ts` 与需要的纯共享代码；禁止复制秘密配置。
3. 运行 `tsc -p apps/miniprogram/tsconfig.json`；任何类型错误立即停止。
4. 复制 src 下 `.wxml/.wxss/.json`、图标与必要静态图片，保持相对结构；生成 sitemap；不复制 `.ts`、测试、源音频、FFmpeg 或 node_modules。
5. 检查 app.json 所有页面四件套的输出完整、组件路径有效、无裸模块导入、无密钥、体积符合项目预算，才允许预览／上传。

项目体积预算设为主包 1.5 MB、全部代码与必要静态资源 10 MB，是项目内部目标而非宣称微信当前平台上限；开发者工具实际包分析和当前官方限额另核实。音视频与大背景走 HTTPS 媒体域名，不随代码上传。

当前页面均放主包，体积超过预算再按实际页面拆包，不预先套复杂分包架构。`pages/entry/index` 为启动页；tabBar 页只有 discover 和 me。新增隐私／关于页面也必须注册。

## 4. 根脚本契约

| 命令 | 实现内容 | 成功输出／失败规则 |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 按锁文件安装 | 锁不一致必须失败；首次 S01 先生成锁文件 |
| `pnpm contract:check` | 验证 OpenAPI、配置 schema、样例、内部引用和场景覆盖 | 错误文件／路径可定位，退出码非零 |
| `pnpm db:migrate` | 对显式 DATABASE_URL 应用未执行迁移 | 显示迁移版本；生产需环境确认并先备份 |
| `pnpm db:seed` | 加载开发样例和测试标识 | 非 dev／test 必须拒绝；不能填真实乐队素材 |
| `pnpm dev:api` | 启动本地 API，默认 3000 | `/health/ready` 包含数据库检查结果，不输出连接密码 |
| `pnpm dev:worker` | 启动单槽 Worker | 已连接测试库／桶，空队列不报故障 |
| `pnpm dev:admin` | 启动管理端，默认 5173 | 后台与用户端鉴权完全分开 |
| `pnpm build:mp:dev` | 构建开发包 | dist 原生工程完整，明确 DEV 标记 |
| `pnpm build:mp:staging` | 构建真机测试包 | 使用 HTTPS 测试域名和真实微信适配器 |
| `pnpm build:mp:prod` | 构建提审包 | 生产域名、无 mock／seed／密钥，生成 build-manifest |
| `pnpm typecheck` / `pnpm lint` | 全部包静态检查 | 小程序与 Node 类型环境分离 |
| `pnpm test:unit` / `pnpm test:integration` / `pnpm test:media` | 对应领域／数据库／FFmpeg测试 | 使用隔离数据，失败保留去敏日志 |
| `pnpm check` | contract、typecheck、lint、unit | 不包含需要真人的真机和审核，不能以此宣称已上线 |

S01 可只建立能真实执行的空工程检查；尚无业务测试时明确显示“0 business tests”，不能写永远 exit 0 的假测试脚本。对应任务创建测试后纳入 CI。

## 5. 配置与适配器

| 配置 | 暴露范围 | 规则 |
| --- | --- | --- |
| AppID、API_ORIGIN、APP_ENV、BUILD_ID | 小程序包可见 | AppID 不是密钥；环境由构建固定，不能只依据 envVersion 自动跳测试后端 |
| WX_APP_SECRET、OpenID 加密版本密钥／HMAC密钥 | API | 由部署平台注入；禁止进浏览器、日志和 git |
| DATABASE_URL | API／Worker | 分环境，生产最小权限；迁移单独账号 |
| COS_REGION／BUCKET、访问角色 | API／Worker | 优先工作负载身份；小程序只拿短期读取地址 |
| SHARE_HMAC_KEY_VERSION 与版本密钥 | API | 密钥轮换保留旧版本至对应链接到期或显式全量撤销 |
| ADMIN_CSRF_KEY_VERSION与版本密钥、ADMIN_TOTP_ENCRYPTION_KEY | API | 独立于分享/OpenID密钥；CSRF可重建派生、TOTP加密，规则见docs/13 |
| RENDER_CONCURRENCY、LEASE_SECONDS、JOB_TIMEOUT_SECONDS | Worker | 初始 1、60、120，按压测调整；不随用户请求传入 |

`WechatIdentity.exchange(code)`、`TextModeration.check(text, userContext)`、`ObjectStore.signRead/upload/head/delete`、`Renderer.render(spec)` 采用接口注入。mock 只能在测试／dev 显式开启，生产启动检测到 mock 直接失败。

## 6. 容器、CI 与供应链

API 和 Worker 分镜像：Worker 固定 FFmpeg、ffprobe、字体和文字绘制依赖；使用非 root 用户、有界 CPU／内存／临时目录，不下载任意用户 URL。关闭容器后删除任务临时文件，失败保留有限去敏诊断信息。

CI 顺序为契约检查→类型与 lint→领域测试→临时 PostgreSQL 集成测试→短素材媒体测试→构建小程序和服务镜像。CI 默认不提交微信审核或发布生产；上传能力可在后续显式接入 `miniprogram-ci`，密钥和可信 IP 由管理员配置，不能借此绕过权限。

产物清单包括 git SHA、依赖锁摘要、镜像摘要、API契约版本、数据库版本、MP 构建环境、AppID与 buildId。每个发布包可追溯到确定源代码。

## 7. 精确步骤所需补充脚本

| 命令 | 建立于 | 必须行为 |
| --- | --- | --- |
| `pnpm test:file -- tests/...test.ts` | S01 | Node runner去掉可选--后验证文件存在，调用Vitest指定文件；无用例/文件不存在失败；不执行全部无关测试 |
| `pnpm contracts:generate` | S02 | 从唯一OpenAPI生成纯类型，可重复且零差异 |
| `pnpm media:spike` | S03 | 输出测试MP4/封面/ffprobe与耗时报告；缺授权字体明确失败 |
| `pnpm build:admin` | S32 | 构建Vue静态管理端 |
| `pnpm deploy:check` / `pnpm deploy:apply` | S36 | 显式环境/manifest，按docs/17检查或变更，不猜生产 |
| `pnpm backup:run` / `pnpm restore:verify` | S37 | 一致性备份、默认仅隔离恢复、删除清单重放 |
| `pnpm health:check` | S38 | API/Worker/队列/备份/清理检查，失败非零 |
| `pnpm capacity:check` | S39 | staging真实负载及容量报告，不打生产 |
| `pnpm release:check` | S41 | prod包/配置/材料manifest检查，未满足门槛失败 |

S01创建根test:file runner与Vitest依赖；各卡实现自己的测试文件后才执行。脚本的env参数必须使用白名单。dev/staging的diagnostics页面在prod构建中连同测试数据完全排除。
