# 数据模型、接口与一致性约定

本文是实施契约草案，不是已部署 API 或数据库迁移。字段采用数据库 snake_case、API camelCase；时间存 UTC／`timestamptz`，用户展示与每日额度按 Asia/Shanghai。所有标识使用不可枚举的 UUID／安全随机值，仍必须校验权限。

## 1. 核心数据模型

| 表 | 关键字段（建议类型） | 约束／说明 |
| --- | --- | --- |
| `users` | `id uuid`、`appid text`、`openid_digest text`、`openid_ciphertext text`、`display_name text`、`name_version int`、`status text`、时间戳 | UNIQUE(appid, openid_digest)；称呼可空；状态 active/deleting/deleted |
| `sessions` | `id uuid`、`user_id uuid`、`token_hash text`、`expires_at timestamptz`、`revoked_at` | token_hash 唯一；永不存令牌明文 |
| `campaigns` | `id uuid`、`slug text`、`title text`、`artist_name text`、`album_name text`、`status text`、`starts_at`、`ends_at`、`retain_until`、`rights_until`、`current_release_id uuid` | slug 唯一；开始早于结束；保留期限不晚于权利截止；带乐队运营联系方式引用 |
| `assets` | `id uuid`、`kind text`、`object_key text`、`sha256 text`、`mime text`、`bytes bigint`、`media_info jsonb`、`rights_until`、`approval_status` | 上传后不可原地替换；对象路径私有；metadata 保存时长、宽高、音轨等 |
| `variants` | `id uuid`、`campaign_id uuid`、`label text`、`audio_asset_id`、`background_asset_id`、`base_video_asset_id`、`font_asset_id`、`layout jsonb`、`config_hash text`、`status` | 每条代表不可变版本；更新创建新 id；资产 FK 不允许随意级联删除 |
| `campaign_releases` | `id uuid`、`campaign_id uuid`、`version int`、`rules jsonb`、`published_at`、`published_by` | UNIQUE(campaign_id, version)；发布后快照不可变 |
| `release_variants` | `release_id uuid`、`variant_id uuid`、`weight int` | 联合主键；weight > 0；发布前确保至少一项且总权重不超安全随机范围 |
| `invitations` | `id uuid`、`user_id uuid`、`campaign_id uuid`、`release_id uuid`、`variant_id uuid`、`current_revision_id uuid?`、`pending_revision_id uuid?`、`status`、`drawn_at`、`deleted_at` | **UNIQUE(user_id, campaign_id)**；款式／发布版本永久固定；指针必须指向本邀请函版本 |
| `invitation_revisions` | `id uuid`、`invitation_id uuid`、`revision_no int`、`name_snapshot text`、`name_version int`、`render_spec jsonb`、`render_key text`、`status text`、`video_key text?`、`poster_key text?`、`media_expires_at` | UNIQUE(invitation_id, revision_no)；render_key 唯一；包含字体／布局／母版哈希 |
| `render_jobs` | `id uuid`、`revision_id uuid`、`status text`、`stage text`、`generation int`、`attempts int`、`run_after`、`lease_owner text?`、`lease_epoch bigint`、`lease_until`、`last_error_code`、`cancel_requested bool` | UNIQUE(revision_id)；重试复用任务行；新周期需授权并增加 generation、重置周期内 attempts；对(status, run_after)建索引 |
| `share_links` | `id uuid`、`invitation_id uuid`、`revision_id uuid`、`token_hash text`、`token_key_version int`、`expires_at`、`revoked_at` | token_hash 唯一；令牌按独立密钥与分享 id 派生以支持幂等重放；查验活动、用户、邀请函和版本状态后才返回内容 |
| `idempotency_records` | `actor_id`、`route_scope`、`key`、`request_hash`、`resource_id`、`status_code`、`expires_at` | UNIQUE(actor_id, route_scope, key)；原始响应不含需长期保存的媒体签名 URL |
| `daily_usage` | `user_id`、`campaign_id?`、`action`、`local_date`、`used int`、`reserved int` | 用户／作用域／动作／日期唯一；并发先预留，成功转 used，失败释放；NULL 范围用固定 scope_key 规范化 |
| `admin_audit` / `event_log` | 管理动作摘要／事件类型、内部 actor_id、实体 id、时间、request_id | 不记录称呼原文、OpenID、令牌或密钥；运营与用户行为分表分权 |

方案中的管理身份由独立身份提供方或成熟鉴权模块管理，保留本地 `admin_roles`／权限映射；不把管理员密码放入业务配置。数据库中外键、唯一约束、非负 CHECK 与状态枚举应落成实际迁移，不能只靠前端约定。

## 2. 状态模型

| 实体 | 状态／转换 |
| --- | --- |
| 活动 | draft → scheduled → live → ended；live 可 paused／恢复；任意已发布状态可 withdrawn；普通写操作不能重新开放过期活动 |
| 邀请函 | active／blocked／deleting／deleted；独立于文件生成状态 |
| 文件版本 | queued → processing → ready；processing → failed；failed → queued（重试）；ready → expired → queued（允许时重建）；任意未完成状态可 cancelled |
| 任务 | queued → running → succeeded；running → retry_wait → running；耗尽或永久错误 → failed；授权撤回／删除 → cancelled |
| 处理阶段 | queued／rendering／uploading／validating／complete；阶段不是精确百分比 |

邀请函首次 `current_revision_id=null`，成功后指向 ready 版本。更新姓名时只设 `pending_revision_id`；新版本成功时检查仍为该 pending，再原子切换 current、清空 pending、撤销旧分享。失败保留 pending 供重试和当前旧版本；需要重新用另一个名字时先取消失败版本，再创建新 revision，不能修改旧快照。

## 3. 接口通用约定

基础路径 `/api/v1`；JSON UTF-8；所有写接口校验 Content-Type、请求大小和字段白名单；用户接口使用 `Authorization: Bearer <session>`，管理端独立管理员会话。错误统一包含 `code`、用户可见 `message`、`requestId` 和可选 `retryAfterSeconds`，不透传原始 FFmpeg 日志。

抽取、改名合成、重试、分享创建和删除请求使用 `Idempotency-Key`（客户端生成 UUID）。同作用域＋键＋相同请求返回同一资源；相同键不同请求体返回 409。幂等记录保留至少 24 小时，记录过期后仍由业务唯一约束防止重复抽取；删除和分享操作也按实体状态幂等执行。

## 4. 用户接口清单

| 方法与路径 | 请求／用途 | 返回与关键约束 |
| --- | --- | --- |
| `POST /auth/wechat` | `{code, privacyNoticeVersion}` | `{accessToken, expiresAt, user}`；后端验证微信身份；隐私同意如适用需另留证明，不能只信版本字符串 |
| `GET /me` | 当前用户 | `{id, displayName, nameVersion}`；不返回 OpenID |
| `PATCH /me` | `{displayName, expectedNameVersion}` | 审核通过后更新版本；409 提示刷新称呼 |
| `GET /campaigns` | `cursor, limit` | 可展示活动及状态；不暴露未发布资产 |
| `GET /campaigns/{id}` | 活动详情 | 规则、活动时间、有效款式说明、`myInvitationId`、`canDraw` |
| `POST /campaigns/{id}/draw` | `{expectedNameVersion}` | 首次 202；已有则 200 返回同一邀请函；不接受自选 variant |
| `GET /me/invitations` | `cursor, limit` | 当前用户作品摘要列表 |
| `GET /invitations/{id}` | 恢复／轮询 | 所有者专用；current、pending、可执行动作；他人请求统一 404 |
| `POST /invitations/{id}/revisions` | `{expectedNameVersion}` | 使用当前用户新称呼生成；202；同名返回原版本；不改变款式 |
| `POST /invitations/{id}/retry` | `{revisionId}` | 仅 `canRetry=true` 时唤醒预算内重试，或启动合法过期重建；202 或返回现有处理中任务；不改变款式 |
| `GET /invitations/{id}/media` | `revisionId, purpose=playback\|download` | 短期地址和 expiresAt；仅就绪且拥有访问权可签发 |
| `POST /invitations/{id}/share` | `{revisionId, consent:true}` | 201：`sharePath, expiresAt`；仅当前成功版本可创建，令牌只在创建响应明文出现 |
| `DELETE /invitations/{id}/share` | 关闭该邀请函全部分享 | 204，立即阻止后续分享 API 访问 |
| `GET /shares/{token}` | 分享令牌，不要求个人会话 | 已允许的只读专辑／邀请函／短期媒体信息；无效统一 404／410，不暴露内部用户 id |
| `DELETE /invitations/{id}` | `{confirm:true}` | 202 清理中；删除不会增加同活动抽取额度，保留最小抽取占位记录至活动清理 |
| `DELETE /me` | `{confirm:true}` | 202；立即撤销会话与分享，异步清理个人记录；完全删除后再登录视作新用户，不承诺永久防重抽 |
| `POST /events` | 限定事件批量，最多 20 条 | 202；事件字段白名单与大小限制；关键计数以服务端事件为准 |

公开活动和分享访问接口如允许匿名读取，采用单独 DTO，不复用带 `myInvitationId` 的完整用户响应。`POST /auth/wechat` 不进行无条件自动重试一次性 code；交换失败由客户端重新获取 code。

## 5. 管理接口清单

所有 `/admin/*` 入口需要独立管理员鉴权、CSRF 保护（使用 Cookie 时）、RBAC 与审计。首版设编辑、发布、管理员三类权限；同一运营可持多角色，但发布和删除留明确操作记录。

| 接口组 | 建议路径 | 行为 |
| --- | --- | --- |
| 活动编辑 | `GET/POST /admin/campaigns`、`PATCH /admin/campaigns/{id}` | 只编辑草稿字段；预览与正式活动隔离 |
| 上传与检验 | `POST /admin/assets/upload-ticket`、`POST /admin/assets/{id}/complete`、`GET /admin/assets/{id}` | 限定类型／大小／对象路径的上传票据，服务端媒体检查后可用 |
| 款式管理 | `POST /admin/campaigns/{id}/variants`、`POST /admin/variants/{id}/prepare` | 创建不可变版本、预制母版、检查结果 |
| 发布与控制 | `POST /admin/campaigns/{id}/publish`、`POST /admin/campaigns/{id}/pause`、`POST /admin/campaigns/{id}/resume`、`POST /admin/campaigns/{id}/withdraw` | 发布配置快照；恢复只允许活动期内；撤回给出原因并中止相关服务 |
| 任务与数据 | `GET /admin/jobs`、`POST /admin/jobs/{id}/retry`、`GET /admin/campaigns/{id}/metrics` | 任务排查／受控重试；不提供任意用户数据导出 |

## 6. 关键响应示例

请求 `POST /campaigns/campaign_demo/draw`，身份和幂等键放 Header；下例的短 id 仅用于阅读，真实实现采用 UUID。

```json
{"expectedNameVersion": 2}
```

首次创建返回 HTTP 202：

```json
{
  "invitationId": "inv_demo",
  "campaignId": "campaign_demo",
  "variant": {"id": "variant_demo", "label": "夜色来信"},
  "currentRevision": null,
  "pendingRevision": {
    "id": "rev_demo",
    "nameSnapshot": "小林",
    "status": "queued",
    "stage": "queued"
  },
  "pollAfterMs": 2000,
  "requestId": "req_demo"
}
```

生成完成后查询响应包含 `currentRevision.status="ready"` 和媒体元数据；签名 URL 按需获取，不固化到数据库快照或埋点。分享响应的 `sharePath` 形如 `/pages/share/index?t=<opaque-token>`，只含不透明令牌。

## 7. 抽取事务伪代码

```text
校验会话与幂等键，读取已存在幂等结果；不同请求体冲突则拒绝
BEGIN
  锁定用户行；确认有效身份、已审核称呼与 expectedNameVersion
  先查 user_id + campaign_id 已有邀请函；存在则复用，结束本次创建
  锁定活动当前发布版本；检查 live、时间、权利、保留规则和服务容量
  读取该不可变发布版本的可用组合与正整数权重
  用服务端安全随机整数抽取 variant_id
  INSERT invitation（用户＋活动唯一）
  INSERT revision（称呼、母版／字体／模板快照）
  INSERT render_job；记录幂等键→邀请函；写服务端 draw_created 事件
COMMIT
返回已提交的结果；唯一约束冲突时回滚并读取既有邀请函
```

容量判定若拒绝，必须在插入抽取前返回可重试状态；成功创建后的渲染失败不退回成“未抽取”。所有接口遵循统一锁顺序，缩短事务，不在锁内调用微信网络 API 或执行视频处理。用户称呼文本审核在事务外完成，写入时再检查版本；审核结果绑定原始规范化文本的摘要。

## 8. 错误码与限流

| HTTP／code | 场景 | 用户端处理 |
| --- | --- | --- |
| 400 `NAME_INVALID` | 长度／字符不支持 | 保留输入并显示对应规则 |
| 422 `NAME_REJECTED` | 内容检查不通过 | 修改称呼 |
| 401 `SESSION_EXPIRED` | 登录过期 | 重新登录一次并恢复原页面 |
| 404 `NOT_FOUND` | 对象不存在或非所有者 | 通用不存在提示，不泄露他人状态 |
| 409 `NAME_VERSION_CONFLICT` | 当前称呼已变更 | 刷新用户信息，请用户重新确认 |
| 409 `REVISION_IN_PROGRESS` | 已有待生成新版 | 展示现有任务，不再创建 |
| 409 `IDEMPOTENCY_CONFLICT` | 相同幂等键不同请求体 | 修复客户端请求，不自动换键重抽 |
| 410 `CAMPAIGN_UNAVAILABLE` | 活动结束、撤回或授权到期 | 说明相应状态，保留适用的已生成访问入口 |
| 429 `RATE_LIMITED` | 超额或访问过频 | 遵循 Retry-After，不反复点击 |
| 503 `RENDER_CAPACITY_BUSY` | 新抽取容量不足 | 未消费抽取额度，稍后可重试 |
| 503 `MODERATION_UNAVAILABLE` | 内容检查依赖失败 | 保留原姓名，稍后重试 |

默认抽取写接口每用户 5 次／分钟，称呼提交 10 次／分钟，任务查询每用户 30 次／分钟；分享令牌查询另按 token 与来源 IP 限流。数值为初始配置，压测后调整；不能只按共享出口 IP 封禁正常用户。
