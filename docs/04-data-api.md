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
| `campaign_releases` | `id uuid`、`campaign_id uuid`、`version int`、`rules jsonb`、`published_at`、`published_by`、`display_snapshot jsonb`（标题、艺人、专辑、封面、收听入口与确认引用） | UNIQUE(campaign_id, version)；发布后快照不可变 |
| `release_variants` | `release_id uuid`、`variant_id uuid`、`weight int` | 联合主键；weight > 0；发布前确保至少一项且总权重不超安全随机范围 |
| `invitations` | `id uuid`、`user_id uuid`、`campaign_id uuid`、`release_id uuid`、`variant_id uuid`、`current_revision_id uuid?`、`pending_revision_id uuid?`、`status`、`drawn_at`、`deleted_at` | **UNIQUE(user_id, campaign_id)**；款式／发布版本永久固定；指针必须指向本邀请函版本 |
| `invitation_revisions` | `id uuid`、`invitation_id uuid`、`revision_no int`、`name_snapshot text`、`name_version int`、`render_spec jsonb`、`render_key text`、`status text`、`video_key text?`、`poster_key text?`、`media_expires_at` | UNIQUE(invitation_id, revision_no)；render_key 唯一；包含字体／布局／母版哈希 |
| `render_jobs` | `id uuid`、`revision_id uuid`、`status text`、`stage text`、`generation int`、`attempts int`、`run_after`、`lease_owner text?`、`lease_epoch bigint`、`lease_until`、`last_error_code`、`cancel_requested bool` | UNIQUE(revision_id)；重试复用任务行；新周期需授权并增加 generation、重置周期内 attempts；对(status, run_after)建索引 |
| `share_links` | `id uuid`、`invitation_id uuid`、`revision_id uuid`、`token_hash text`、`token_key_version int`、`expires_at`、`revoked_at` | token_hash 唯一；令牌按独立密钥与分享 id 派生以支持幂等重放；查验活动、用户、邀请函和版本状态后才返回内容 |
| `idempotency_records` | `actor_id`、`route_scope`、`key`、`request_hash`、`resource_id`、`status_code`、`expires_at` | UNIQUE(actor_id, route_scope, key)；原始响应不含需长期保存的媒体签名 URL |
| `daily_usage` | `user_id`、`campaign_id?`、`action`、`local_date`、`used int`、`reserved int` | 用户／作用域／动作／日期唯一；并发先预留，成功转 used，失败释放；NULL 范围用固定 scope_key 规范化 |
| `admin_audit` / `event_log` | 管理动作摘要／事件类型、内部 actor_id、实体 id、时间、request_id | 不记录称呼原文、OpenID、令牌或密钥；运营与用户行为分表分权 |

管理身份采用独立 `admin_users/admin_sessions`、Argon2id与TOTP，首版本地管理；会话与权限细节见 docs/13。不把明文密码或TOTP种子放入业务配置。数据库中外键、唯一约束、非负 CHECK 与状态枚举应落成实际迁移，不能只靠前端约定。

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

称呼修改、抽取、改名合成、重试、分享创建和删除请求按OpenAPI要求使用 `Idempotency-Key`（客户端生成 UUID）。同作用域＋键＋相同请求返回同一资源；相同键不同请求体返回 409。幂等记录保留至少 24 小时，记录过期后仍由业务唯一约束防止重复抽取；删除和分享操作也按实体状态幂等执行。

## 4. 全部 HTTP 操作（与 OpenAPI 同步）

本表按当前机器契约生成；完整字段、required、响应和权限见 [openapi.json](../specs/openapi.json)。基路径 `/api/v1`。响应直接返回对象。

| 方法/路径 | operationId | 成功状态 | 用途 |
| --- | --- | --- | --- |
| `POST /auth/wechat` | `createSession` | 201 | 微信code换取业务会话 |
| `GET /me` | `getMe` | 200 | 当前用户 |
| `PATCH /me` | `updateName` | 200 | 修改默认称呼 |
| `DELETE /me` | `deleteAccount` | 202 | 删除账号并启动清理 |
| `GET /campaigns` | `listCampaigns` | 200 | 活动列表 |
| `GET /campaigns/{id}` | `getCampaign` | 200 | 本人活动信息与抽取资格 |
| `GET /public/campaigns` | `listPublicCampaigns` | 200 | 匿名可见活动列表 |
| `GET /public/campaigns/{id}` | `getPublicCampaign` | 200 | 匿名活动详情 |
| `POST /campaigns/{id}/draw` | `drawInvitation` | 202/200 | 原子创建一次抽取 |
| `GET /me/invitations` | `listMyInvitations` | 200 | 本人作品列表 |
| `GET /invitations/{id}` | `getInvitation` | 200 | 查询本人邀请函与生成状态 |
| `DELETE /invitations/{id}` | `deleteInvitation` | 202 | 删除作品内容并保留最小抽取占位 |
| `POST /invitations/{id}/revisions` | `createNameRevision` | 202/200 | 以当前称呼更新原款邀请函 |
| `DELETE /invitations/{id}/pending-revision` | `cancelFailedPending` | 200 | 取消失败的改名版本 |
| `POST /invitations/{id}/retry` | `retryInvitation` | 202/200 | 唤醒可恢复任务或重建过期文件 |
| `GET /invitations/{id}/media` | `getMedia` | 200 | 获取当前ready版本短期媒体地址 |
| `POST /invitations/{id}/share` | `createShare` | 201/200 | 明确开启当前版本分享 |
| `DELETE /invitations/{id}/share` | `revokeShares` | 204 | 关闭邀请函全部分享 |
| `GET /shares/{token}` | `getSharedInvitation` | 200 | 使用分享令牌只读访问 |
| `POST /events` | `ingestEvents` | 202 | 接收去敏客户端事件 |
| `POST /admin/auth/session` | `adminLogin` | 201 | 管理员密码与TOTP登录 |
| `GET /admin/auth/session` | `adminSession` | 200 | 读取管理员会话与CSRF令牌 |
| `DELETE /admin/auth/session` | `adminLogout` | 204 | 退出管理员会话 |
| `GET /admin/campaigns` | `adminListCampaigns` | 200 | 后台活动列表 |
| `POST /admin/campaigns` | `adminCreateCampaign` | 201 | 创建活动草稿 |
| `GET /admin/campaigns/{id}` | `adminGetCampaign` | 200 | 后台活动详情 |
| `PATCH /admin/campaigns/{id}` | `adminUpdateCampaign` | 200 | 版本保护的活动更新 |
| `POST /admin/assets/upload-ticket` | `adminUploadTicket` | 201 | 创建受限素材上传票据 |
| `POST /admin/assets/{id}/complete` | `adminCompleteAsset` | 202 | 提交上传完成并启动媒体检查 |
| `GET /admin/assets/{id}` | `adminGetAsset` | 200 | 读取素材检查状态 |
| `POST /admin/assets/{id}/approve` | `adminApproveAsset` | 200 | 确认素材使用范围 |
| `POST /admin/assets/{id}/withdraw` | `adminWithdrawAsset` | 202 | 撤回素材并封禁受影响作品 |
| `POST /admin/campaigns/{id}/variants` | `adminCreateVariant` | 201 | 创建不可变款式版本 |
| `GET /admin/campaigns/{id}/variants` | `adminListVariants` | 200 | 查询活动的不可变款式列表 |
| `GET /admin/variants/{id}` | `adminGetVariant` | 200 | 查询款式与母版状态 |
| `POST /admin/variants/{id}/prepare` | `adminPrepareVariant` | 202 | 预制款式母版 |
| `POST /admin/variants/{id}/approve` | `adminApproveVariant` | 200 | 确认母版与排版预览 |
| `POST /admin/campaigns/{id}/publish` | `adminPublishCampaign` | 201 | 验证并发布不可变配置快照 |
| `POST /admin/campaigns/{id}/pause` | `adminPauseCampaign` | 200 | 暂停新增生成 |
| `POST /admin/campaigns/{id}/resume` | `adminResumeCampaign` | 200 | 恢复有效期内活动 |
| `POST /admin/campaigns/{id}/withdraw` | `adminWithdrawCampaign` | 200 | 下架活动与撤回访问 |
| `GET /admin/jobs` | `adminListJobs` | 200 | 查看渲染和母版预制任务 |
| `POST /admin/jobs/{id}/retry` | `adminRetryJob` | 202 | 排障后授权新执行周期 |
| `GET /admin/campaigns/{id}/metrics` | `adminGetMetrics` | 200 | 按定义查询活动统计 |
| `GET /admin/assets` | `adminListAssets` | 200 | 分页查询可选择素材 |
| `GET /admin/variants/{id}/preview` | `adminGetVariantPreview` | 200 | 读取母版对应固定测试名字成片 |

## 5. 用户与管理请求的精确约定

登录输入 `{code, privacyNoticeVersion, consentAction:"agree"}`，返回201 Session；code一次性、不复用、不记录。`PATCH /me`携带Idempotency-Key和expectedNameVersion。JSON结构与完整示例在 [api-examples.json](../specs/api-examples.json)，不使用短假ID模拟可执行请求。

后台使用独立用户名/密码/TOTP、同源Cookie和CSRF；实现见 [docs/13](13-database-implementation.md)。角色editor/publisher/admin由每个操作的x-required-roles-any控制；权限是服务端判断。素材列表、款式列表、固定预览均有接口；封面和分享图用已审核cover资产，收听只允许search_hint或已验证mini_program。

公开活动variants只来源于当前不可变发布快照，返回weight/totalWeight，totalWeight须等于该快照权重总和；不返回未发布资产和私人邀请字段。用户详情current/pending/capabilities以HTTP契约为准。

## 6. 发布、预览与资料完整性

后台上传票据先建awaiting_upload资产；complete确认真实对象后入asset_check_jobs；检查通过且权利确认后才能引用。prepare生成母版与三种固定测试名字成片，preview读取短期地址。批准动作绑定configHash，不能批准尚未看到的旧预览。

发布要求coverAssetId/shareCoverAssetId和listenDestination完整；mini_program额外提交listenEvidenceRef。音频/背景/字体/封面和预览均通过检查，所有时限合法后才建立release。更新活动显示文案/封面/收听入口先进入草稿；公开接口读release快照直到下一次publish，避免未审核变更泄漏。

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
