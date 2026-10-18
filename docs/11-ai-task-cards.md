# 精确步骤索引 v1.2

先读 [操作手册](15-model-execution-manual.md)。S00–S43 是唯一执行顺序，旧P编号只保留阶段映射；附件T00–T42不再执行。D=DeepSeek，G=Grok，H=人工；每项有另一模型复核和G0–G5阶段检查。任务依赖允许账号阻塞时推进独立后端项，不能跳过真机/发布门槛。

机器清单：[execution-plan.json](../specs/execution-plan.json)。用 `node scripts/prepare-task.mjs Sxx --role implement` 生成当前卡和相关章节/接口；review参数生成复核提示。

| 顺序 | 执行/复核 | 步骤 | 前置 | 旧阶段 |
| --- | --- | --- | --- | --- |
| S00 | D/G | [核对输入与账号台账](tasks/S00.md) | 无 | P00 |
| S01 | D/G | [建立 workspace 与唯一构建](tasks/S01.md) | S00 | P01 |
| S02 | D/G | [标准契约校验与类型生成](tasks/S02.md) | S01 | P02 |
| S03 | G/D | [真实中文视频技术验证](tasks/S03.md) | S01 | P04 |
| S04 | G/D | [M0 原生媒体与真机验证](tasks/S04.md) | S03, S02 | P04 |
| S05 | D/G | [API 启动与统一错误](tasks/S05.md) | S02 | P01 |
| S06 | D/G | [环境配置与适配器隔离](tasks/S06.md) | S05 | P01 |
| S07 | G/D | [身份库与迁移执行器](tasks/S07.md) | S05, S06 | P02 |
| S08 | G/D | [活动素材与快照库](tasks/S08.md) | S07 | P02 |
| S09 | G/D | [邀请函、任务、额度与管理库](tasks/S09.md) | S08 | P02 |
| S10 | G/D | [微信登录与可撤销会话](tasks/S10.md) | S06, S09 | P03 |
| S11 | D/G | [称呼与字体校验纯函数](tasks/S11.md) | S03, S02 | P03 |
| S12 | G/D | [改名、内容审核与额度](tasks/S12.md) | S10, S11, S09 | P03 |
| S13 | D/G | [私有存储与签名接口](tasks/S13.md) | S06 | P04 |
| S14 | G/D | [管理员身份、Cookie 与 CSRF](tasks/S14.md) | S09, S06 | P05 |
| S15 | G/D | [素材上传、列表与技术检查](tasks/S15.md) | S13, S14, S09, S03 | P05 |
| S16 | D/G | [活动草稿、封面与收听配置](tasks/S16.md) | S14, S08, S15 | P05 |
| S17 | G/D | [款式母版、预览与批准](tasks/S17.md) | S15, S16, S03 | P04 |
| S18 | G/D | [发布快照、概率与公开查询](tasks/S18.md) | S17, S16 | P05 |
| S19 | G/D | [一次抽取与幂等事务](tasks/S19.md) | S12, S18, S09 | P06 |
| S20 | G/D | [Worker 租约与最终写回](tasks/S20.md) | S19, S13, S03 | P07 |
| S21 | D/G | [作品读取、列表与状态恢复](tasks/S21.md) | S20 | P08 |
| S22 | G/D | [改名新版、取消与受控重试](tasks/S22.md) | S21, S12 | P09 |
| S23 | G/D | [媒体与只读分享 API](tasks/S23.md) | S22, S13 | P10 |
| S24 | D/G | [原生端请求、会话与导航](tasks/S24.md) | S21, S02 | P08 |
| S25 | G/D | [集中隐私授权组件](tasks/S25.md) | S24, S04 | P10 |
| S26 | D/G | [发现、称呼与活动页](tasks/S26.md) | S24, S12, S18, S11 | P08 |
| S27 | G/D | [邀请函页与播放器状态](tasks/S27.md) | S26, S21, S22 | P08 |
| S28 | G/D | [删除、撤回与到期清理](tasks/S28.md) | S23, S20 | P12 |
| S29 | G/D | [下载与相册保存](tasks/S29.md) | S27, S25, S23 | P10 |
| S30 | D/G | [好友分享与匿名进入](tasks/S30.md) | S27, S23 | P10 |
| S31 | D/G | [我的、法律说明与删除入口](tasks/S31.md) | S28, S26 | P12 |
| S32 | D/G | [管理端登录与权限外壳](tasks/S32.md) | S14 | P11 |
| S33 | D/G | [后台素材、活动与发布表单](tasks/S33.md) | S32, S18 | P11 |
| S34 | D/G | [任务看板与去敏统计](tasks/S34.md) | S32, S20, S18 | P11 |
| S35 | G/D | [端到端与负向回归](tasks/S35.md) | S28, S29, S30, S31, S33, S34 | P13 |
| S36 | G/D | [容器与可追溯部署](tasks/S36.md) | S35 | P13 |
| S37 | G/D | [备份与隔离恢复演练](tasks/S37.md) | S36, S28 | P13 |
| S38 | D/G | [监控与运营巡检](tasks/S38.md) | S36, S34 | P13 |
| S39 | G/D | [容量、预算与限流](tasks/S39.md) | S36, S38 | P13 |
| S40 | G/D | [正式环境真机问题修复](tasks/S40.md) | S35, S36, S39, S04 | P14 |
| S41 | D/G | [提审包与材料检查](tasks/S41.md) | S40, S37 | P14 |
| S42 | H/C | [审核、发布与普通用户验收](tasks/S42.md) | S41 | P15 |
| S43 | D/G | [运行交接与后续恢复入口](tasks/S43.md) | S42, S38 | P15 |

应用任务全部未开始。P00–P15的完成状态由相关S卡及人工证据共同推导；不得因为方案文档已写好就标P任务DONE。
