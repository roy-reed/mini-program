# 专辑来信：微信小程序方案与执行手册 v1.2

输入称呼，随机获得预制副歌与背景组合，生成写有「诚邀 XXX 收听」的音乐视频邀请函。再次进入恢复同一款式；改名只更新文字版本。

**本仓库当前交付方案、机器契约和模型操作手册，应用尚未实现。** 本版结合原流程图、PR #2 和用户上传的另一模型方案完成裁决，不需要在两套技术路线中再次选择。

## 先读这三个入口

| 目的 | 入口 |
| --- | --- |
| 看两份方案保留什么、修正什么 | [融合评审与最终裁决](docs/14-synthesis-decisions.md) |
| 知道每步交给谁、怎样操作和验收 | [DeepSeek / Grok 精确操作手册](docs/15-model-execution-manual.md) |
| 直接选择当前一步 | [S00–S43 步骤索引](docs/11-ai-task-cards.md) · [实施状态](IMPLEMENTATION_STATUS.md) |

D=DeepSeek V4.1 Flash或同级，G=Grok 4.7或同级，C=本对话Codex裁决，H=项目负责人实际操作。分工是本项目安排，不是模型性能评测或成功保证。

## 现在可以执行的命令

```sh
node scripts/check-plan.mjs
node scripts/prepare-task.mjs S00 --role implement
node scripts/prepare-task.mjs S00 --role review
```

任务包包含当前卡、指定章节和所需API契约；不执行代码、不自动调用任何模型。应用的pnpm命令须由对应卡实现，目前不能导入微信开发者工具运行。完整标准检查另见 [验证记录](docs/19-validation.md)。

## 固定技术边界

微信原生 TypeScript/WXML/WXSS；Fastify API、PostgreSQL持久任务、独立FFmpeg Worker、私有COS、Vue表单后台。每用户每活动一次抽取、改名不重抽、真实MP4；首版无H5/web-view、支付、奖品、用户上传或声音克隆。免费随机内容的真实类目、资质、备案和隐私仍由实际微信后台核实。

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [总方案](PROJECT_PLAN.md) / [产品](docs/01-product.md) / [交互](docs/02-experience.md) | 目标、范围、页面与业务规则 |
| [架构](docs/03-architecture.md) / [数据API](docs/04-data-api.md) / [数据库细则](docs/13-database-implementation.md) | 身份、事务、版本、权限、任务、清理 |
| [素材运营](docs/05-assets-operations.md) / [排期验收](docs/06-delivery.md) / [依据](docs/07-evidence-decisions.md) | 资源、容量、用例与事实边界 |
| [工程](docs/08-engineering-blueprint.md) / [微信开发](docs/09-wechat-development.md) / [提审发布](docs/10-wechat-release.md) / [排障](docs/12-troubleshooting.md) | 开发到正式运行 |
| [视频实施](docs/16-media-implementation.md) / [部署恢复](docs/17-deployment-runbook.md) / [人工H01–H10](docs/18-human-operations.md) | 具体算法、命令契约与人工操作 |
| [机器HTTP契约](specs/openapi.json) / [配置Schema](specs/campaign.schema.json) / [配置示例](specs/campaign.example.json) | 唯一字段与结构，示例不可发布 |
| [响应示例](specs/api-examples.json) / [验收场景](specs/acceptance-cases.json) / [步骤清单](specs/execution-plan.json) | 可校验输入输出与执行依赖 |
| [模型入口](AI_START_HERE.md) / [交接](NEXT_SESSION.md) / [仓库约束](AGENTS.md) | 换模型或新对话时恢复 |

原件：[流程图](小程序功能流程图.drawio) · [截图](docs/assets/original-flow.png)。软件许可见 [LICENSE](LICENSE)，不自动授予音乐/字体/图片使用权。附件的原始部署脚本与SQL未作为可执行模板导入本仓库，来源hash记录于 [source-manifest.json](specs/source-manifest.json)。
