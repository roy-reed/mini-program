# 部署、备份与回滚执行约定

S36–S39 实现这些文件后才可执行应用部署命令。当前仓库只有方案与检查工具；本页不是已部署证明。采用 API/Worker 分容器、托管 PostgreSQL 18、私有 COS、Caddy 同源后台；开发库才用本地 Compose。

## 1. 目录与秘密

生产文件固定为 `infra/compose.prod.yml`、`infra/Caddyfile`、`infra/prod.env.example`、`scripts/deploy.mjs`、`scripts/backup.mjs`、`scripts/restore-check.mjs`、`scripts/health-check.mjs`。真实配置放不入 git 的 `infra/prod.env` 或部署平台秘密；脚本只报告缺失/非法键名，不能打印整行、URL密码或完整 `docker compose config` 输出。

小程序只含 WX_APP_ID/API_ORIGIN/APP_ENV/BUILD_ID。API 持有微信、身份与签名密钥；Worker只持有渲染所需数据库/存储权限，不能拥有管理员密码或微信 AppSecret。迁移使用独立数据库账号。备份凭据和目标与业务对象权限隔离。

## 2. 明确的环境约定

Compose 从仓库根执行，统一使用 `docker compose --env-file infra/prod.env -f infra/compose.prod.yml`。文件内 env_file 是容器注入，不能用它替代 CLI 插值来源。生产必须 `APP_ENV=prod`、真实适配器、非占位域名/密钥；prod 和 staging 任意 mock 标记都拒绝启动。禁止接受公网用户提供 mock: code。

首次检查：Docker引擎实际可达、架构正确、时间同步、CPU/内存/临时磁盘限制、DNS/证书链、API→数据库/COS/微信可达。Windows 的 Docker 客户端版本不证明引擎在运行；部署命令在目标 Linux/CI 执行，微信工具在 Windows/macOS 执行。

## 3. 构建与生产切换顺序

| 步骤 | 操作 | 必须证据 |
| --- | --- | --- |
| 1 | CI 从批准 SHA 用锁文件构建 API/Worker/后台镜像，记录 digest；不使用 latest，不在服务器临时装不同依赖 | build-manifest、镜像摘要、依赖与字体许可证 |
| 2 | 在 staging 用同样镜像跑迁移与完整回归，确认上一客户端仍可调用 | 迁移版本、契约兼容、业务/媒体检查 |
| 3 | 生产只读预检：配置结构、依赖连接、备份年龄、磁盘、签名/清理能力 | 去敏 preflight 报告；失败非零退出 |
| 4 | 生成一致性备份并确认可恢复；迁移扩展字段/索引，不立即删旧字段 | 备份校验、最近恢复演练、迁移校验和 |
| 5 | 先应用向后兼容迁移，再更新 API，Worker停止领新任务后限时退出/回收租约；切换固定 digest | 部署记录、任务不丢失/不重复写回 |
| 6 | 探测外部 HTTPS、live/ready、Worker心跳和合成测试；准备 prod 小程序候选包 | 真实新任务成功、原成片可读、buildId一致 |

S36 建立 `pnpm deploy:check -- --env staging` 和 `pnpm deploy:apply -- --env staging --manifest <路径>`；生产同语法换 prod，但只在已有上线授权及 G4 满足时使用。脚本校验 manifest 的 SHA/digest/数据库版本/环境，不静默猜默认生产环境。`--check`不得迁移/重启，`--apply`不能跳过检查。

后台页面位于 `https://api.<实际域名>/admin/`，接口位于同源 `/api/v1/admin/*`。Caddy保留 `/api/v1` 前缀代理；`/admin/` 静态 SPA fallback 不得吞掉 API 404。后台Cookie Path只覆盖管理API；对管理请求不用 CORS 通配放行。

## 4. 备份与恢复

每日数据库一致性备份，30天轮换；验证压缩/校验和与完成时间。素材源文件、发布快照和对象存储引用一并有恢复策略，但不能把已删除对象通过备份重新公开。托管自动备份不免除一次实际恢复演练。

`pnpm backup:run -- --env staging` 创建备份和去敏 manifest。`pnpm restore:verify -- --backup <id> --target isolated` 只允许隔离目标；恢复后执行迁移/行数与引用检查、重放数据库之外保存的删除/撤回清单，再跑一条测试合成。默认拒绝指向生产数据库；实际生产恢复由负责人安排维护窗口，不能由测试命令顺手完成。

删除清单只含内部 ID/动作/时间/截止状态，存在独立受控存储并限制权限；保留至少覆盖最长备份生命周期，过期清理。恢复完成但清单未重放，API不得对外开放。记录实际恢复耗时/可恢复时点，不虚构RPO/RTO。

## 5. 回滚和停止条件

健康失败、数据越权、错误发布素材、持续任务失败时停止新增生成，保留仍有合法权限的旧成片。使用前一个固定镜像与兼容配置；数据库不能自动 DROP/逆迁移回退。若新增结构不兼容旧镜像，优先修复前向迁移，保持暂停服务。

微信包按后台实际回退能力处理；不存在该能力时提交修复版本。任何审核期间功能调整都同时更新代码、后端、材料和验收；不只隐藏前端按钮以保留未披露服务。

## 6. 监控与日常操作

`/health/live`只看进程；`/health/ready`检查必要依赖；Worker心跳/最老排队独立监控，API健康不能证明渲染正常。告警沿用 docs/03 阈值并根据 S39 实测调整；部署前确认告警收件人/值班者真实存在。首版不默认向外部群发送信息，通知渠道由负责人配置。

清理每5分钟领取持久 cleanup_job，先短事务领取再调用COS，成功后确认删除；失败退避且告警。媒体生命周期不能比承诺保留期更短；确需过期缓存重建时保留render_spec/母版并验证权限。发布后15分钟/1小时/24小时按 docs/10 执行并记录，不视为已创建自动化。
