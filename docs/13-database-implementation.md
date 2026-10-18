# 数据库落地、一致性与权限细则

本文件补足 [数据模型](04-data-api.md) 中模型容易猜错的部分；它规定迁移和事务必须做到什么，不表示数据库已运行。HTTP字段以 `specs/openapi.json` 为准。

## 1. 迁移顺序与新增辅助表

| 迁移 | 内容 | 必要检查 |
| --- | --- | --- |
| 001 | users、sessions、privacy_consents | 身份唯一、会话哈希唯一；同意记录含用户、指引版本、动作、时间和来源 |
| 002 | campaigns、assets、variants、campaign_releases、release_variants | 权利和时间字段；不可变版本；weight正整数；活动当前发布外键后置添加 |
| 003 | invitations、invitation_revisions、render_jobs | 用户／活动唯一；revision_no唯一；任务revision唯一；指针外键后置添加 |
| 004 | share_links、idempotency_records、daily_usage | token哈希唯一；幂等复合唯一；额度scope_key非空、计数非负 |
| 005 | admin_users、admin_sessions、admin_audit、event_log | 管理身份独立；密码哈希、TOTP加密、会话哈希、角色CHECK |
| 006 | asset_prepare_jobs、cleanup_jobs、job_attempts | 母版预制与用户渲染分表；持久清理；按周期记录每次执行 |
| 007 | 必要索引、约束、维护操作 | 任务扫描、用户作品分页、分享查询、到期扫描；干净库与升级库均测试 |

`privacy_consents` 记录系统收到的用户动作与版本，不声称单凭前端传值就能证明微信平台授权；平台隐私 API 仍按实际流程处理。`asset_prepare_jobs` 以 variant_id 唯一，状态、租约与渲染任务类似，但没有用户姓名。`cleanup_jobs` 记录 entity_type、entity_id、due_at、status、attempts、lease与去敏错误，用于可重试删除；不把待删除姓名作为payload保存。

`job_attempts` 以 `(job_kind, job_id, generation, attempt_no)` 唯一，记录 lease_epoch、开始／结束、错误类别和输出对象引用，不含姓名。重试周期重置 attempts 时历史仍可审计。

## 2. 字段、外键与索引的明确规则

| 项目 | 落库规则 |
| --- | --- |
| ID／时间 | UUID 主键，UTC timestamptz；应用生成UUID，日期输入必须带时区 |
| 状态／整数 | 文本＋CHECK枚举；weight、generation、revision_no ≥1；attempts／used／reserved ≥0 |
| invitation唯一 | UNIQUE(user_id, campaign_id)，包含软删除占位；不能用“deleted_at为空”部分唯一索引恢复抽取额度 |
| 同活动引用 | variants、releases 增加 UNIQUE(id,campaign_id)；invitation复合FK指向同一campaign；组合必须属于所选release |
| 版本归属 | revisions增加 UNIQUE(id,invitation_id)；current／pending通过复合FK引用本invitation，避免串作品 |
| 单个在途版本 | revision queued/processing 的 partial unique(invitation_id)；失败版本可保留pending，但再次创建前明确取消旧失败pending |
| 分享归属 | 复合FK确保 revision属于invitation；签发时确认仍为当前ready，保存token_key_version和哈希 |
| 已发布素材 | referenced资产禁止ON DELETE CASCADE；需要撤回和清理流程，不能级联删光历史 |
| 分页 | created_at＋id游标稳定排序；limit默认20、最大50，游标为不透明编码并校验 |
| 任务扫描 | `(status,run_after)`、`lease_until`；不把全表扫描做成高频轮询 |
| 幂等键 | UNIQUE(actor_id,route_scope,key)，request_hash依据规范化请求JSON；键不跨用户复用 |

活动的 scheduled/live/ended 是面向产品的状态，但每次写操作都同时检查服务器当前时间，不能只依赖某个定时任务有没有把 live 改成 ended。权利有效期取配置和实际引用资产允许期限的最早值。

## 3. 锁顺序与外部调用

业务写事务统一顺序为 `用户（如适用）→ 活动 → 邀请函 → 版本 → 任务／额度／分享`。Worker最终写回也遵循该顺序；单独领取／续租只锁任务，提交后再做业务操作，不能带着任务锁逆序获取用户锁。管理员批量撤回按稳定 id 顺序分批，减少死锁。

微信登录／文本检查、COS、FFmpeg调用在短事务外执行。需要应用结果时重新锁定并验证身份状态、名称版本、配置版本和权利期限；外部成功不代表数据库状态仍允许提交。

## 4. 六个必须原子提交的动作

| 动作 | 同一事务必须包含 | 不属于事务内的工作 |
| --- | --- | --- |
| 首次抽取 | 唯一邀请函、首版snapshot、任务、pending指针、幂等记录、draw事件 | 动效、文件渲染、对象上传 |
| 称呼修改 | 检查expectedNameVersion、额度、写新称呼／版本、成功用量、幂等结果 | 外部内容审核；审核摘要绑定规范化名称 |
| 姓名重生成 | 检查原款式、预留每日额度、创建revision／job、pending指针、幂等结果 | 渲染 |
| 渲染完成 | 验证租约／取消／权利、revision ready、current切换、pending清空、用量提交、旧share撤销、旧文件清理计划、任务成功 | 上传／ffprobe预先完成 |
| 分享创建／关闭 | 核验owner和ready版本、创建／撤销share记录、幂等结果 | 不在事务内下载视频 |
| 删除／撤回 | 状态禁止访问、撤销session/share（适用时）、任务取消标记、持久cleanup计划 | 实际文件删除、CDN清理与备份轮换 |

首次抽取不消耗“改名重生成额度”。同名更新直接返回当前结果；不预留额度。重试在同一revision／生成周期内复用额度预留；失败到终态释放预留，运营授权重启时重新按规则预留或记录运营豁免，不能重复计数。

## 5. 幂等和响应不确定

幂等检查不能只“先SELECT，没有就INSERT业务”。并发请求都可能看不到记录。使用带唯一约束的事务插入抢占幂等记录，冲突时读取已提交结果；同键不同request_hash返回409。客户端重试必须保留键，服务端资源唯一约束提供第二层保护。

存储资源id和确定的响应状态，不长期保存签名URL。读取已完成资源后生成当前有效响应；原202可能变成200，但资源身份和抽取结果保持一致。分享token可按密钥版本与随机share_id重新派生，确保同键重放不产生第二个链接。关闭分享后对旧创建键重放不能复活链接，应返回 `SHARE_REVOKED`；重新开启使用新键创建新share记录。

## 6. Worker完成与孤立对象

领取任务使用短事务与SKIP LOCKED，先更新lease_epoch／generation／attempts，再提交。完成时同时核验 task id、generation、lease_epoch和有效租约；仅task id相同不够。

结果对象放 `{invitationId}/{revisionId}/{generation}-{leaseEpoch}/video.mp4`，不含称呼／OpenID。上传校验后提交引用；失败旧Worker产物不能覆盖正式对象。未被引用且超过宽限期的临时对象按任务状态确认后删除，不能仅凭年龄误删仍在运行的产物。

同一个revision过期合法重建可能当前指针仍指向它；接口需通过status和canSave阻止读取不存在文件。重建成功不产生新抽取／新称呼版本，保持来源与权限一致。

## 7. 活动状态权限矩阵

| 状态 | 新抽取 | 已有成片读取 | 改名重生成／过期重建 | 分享新建／访问 | 已排队任务 |
| --- | --- | --- | --- | --- | --- |
| draft | 否 | 仅后台测试 | 仅后台测试 | 否 | 仅测试预制 |
| scheduled | 否 | 若有合法既有数据按原权限 | 否 | 已有合法分享按期限 | 不创建用户任务 |
| live | 是 | 是 | 是 | 是 | 执行 |
| paused | 否 | 是 | 否，暂停新生成 | 现成成片可分享／访问 | 暂停前已接收的任务继续 |
| ended且保留有效 | 否 | 是 | 是 | 是 | 执行已接收／合法重建 |
| withdrawn／权利到期／保留到期 | 否 | 否 | 否 | 否 | 取消并清理 |

上表仍需叠加用户、邀请函、资产、revision状态。单款asset撤回只封禁受影响作品；不能重新随机换款。`canDraw/canSave/canShare/canRename/canRetry`由后端按此矩阵计算，前端不复制一套判断逻辑。

## 8. 管理员身份的首版实现

首版采用独立管理员用户名＋密码＋TOTP，不使用用户微信token充当管理权限。通过运维CLI初始化／重置管理员，交互式读取秘密；没有公开注册／找回接口。密码用成熟Argon2id库并按当前建议参数配置，TOTP种子加密保存；管理员状态含active/disabled，角色为editor/publisher/admin。

浏览器管理会话用随机token，数据库仅存hash；Cookie为 HttpOnly、Secure、SameSite=Lax、Path=/api/v1/admin，2小时到期。浏览器写请求校验Origin与CSRF header；登录也检查Origin／JSON类型和限流，不能以“未登录”为理由跳过登录CSRF防护。会话内保存CSRF token hash，客户端通过会话响应获取令牌；角色与启用状态每次校验。

登录连续失败初始5次／15分钟触发限流，区分账号与来源，返回统一登录错误；日志不含密码或TOTP。库中的密码哈希和TOTP密文不出DTO。后续接OIDC可以替换adapter，需单独变更契约。

## 9. 数据删除验收

删除请求立即改变可访问状态并排队清理。接口202表示已接受，不表示文件已全部删完；“我的”与支持流程需能说明正在清理。后台cleanup任务失败重试并告警，目标24小时在线清理、备份按既定轮换消退。

账户完整删除时按依赖清除关联数据和可关联身份，最后删除用户；相同OpenID以后注册视作新用户。作品单独删除则只保留最小抽取占位到活动清理，姓名、媒体、share和revision内容按清理策略移除。恢复备份后重放删除清单，避免数据再次出现。
