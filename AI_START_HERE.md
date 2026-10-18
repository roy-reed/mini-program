# 模型执行唯一入口

本项目是微信原生小程序，方案版本v1.2。当前没有应用实现。用户要求按步骤分配 DeepSeek V4.1 Flash 与 Grok 4.7 等级别模型；不得换成H5演示或一次生成整仓库。

1. 先读 [AGENTS](AGENTS.md)、[状态](IMPLEMENTATION_STATUS.md)、[交接](NEXT_SESSION.md)。确认仓库最新SHA和现有修改。
2. 读 [操作手册](docs/15-model-execution-manual.md)，按 [步骤索引](docs/11-ai-task-cards.md) 选择第一张依赖已满足的未完成S卡。首次从S00开始。
3. 执行 `node scripts/prepare-task.mjs Sxx --role implement`，只把本卡输入交给指定执行模型；复核使用同编号 `--role review`。
4. 真实执行命令，留下证据；另一模型只读复核；需要人工的平台动作按 [H01–H10](docs/18-human-operations.md)，阶段门槛交C确认。
5. 更新 IMPLEMENTATION_STATUS与本卡回执。未执行、无AppID、无设备或未审核的部分明确记录，不报假完成。

HTTP字段以OpenAPI为准，业务规则以docs/01为准，架构裁决见docs/14。发现不一致先修契约和文档，不在代码里静默选一种。附件T系列不再执行，旧P系列仅作阶段映射。

可复制的开工提示：

```text
这是roy-reed/mini-program微信原生小程序项目，执行方案v1.2。
读取AGENTS.md、AI_START_HERE.md、IMPLEMENTATION_STATUS.md。
本轮只执行S00；先生成并读取 node scripts/prepare-task.mjs S00 --role implement。
按指定模型分工、文件范围、输入输出和验收完成；没有实际工具能力时返回补丁并标未验证。
只报告真实运行结果，更新任务回执与状态，不直接开始后续卡。
```

本轮用户要求的是分析优化方案；以上应用执行提示供下一阶段使用，不表示已授权自动购买资源或已提交微信审核。
