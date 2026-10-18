# 视频实现：唯一流水线与验收

当前为设计规格。S03 先证明短样本可运行，S17/S19/S20 接入持久任务。不得直接复制附件 SQL 或把原型服务部署为正式服务。

## 1. 输入与产物

运营上传音频、背景、授权字体；后台把批准组合预制成母版。图片固定居中 cover 裁切到 720×1280；背景视频去除原音轨、循环或裁切到副歌时长；输出只保留批准副歌的一条音轨。母版烧录已批准的固定副标题和品牌视觉，姓名框留空。设计可先交素材预览，但只有系统生成、校验并批准的 immutable 母版成为本版本输入。首版不另开“外部母版直入”路径。

每个用户成片仅叠加动态主文案 `诚邀 {displayName} 收听` 的透明 PNG。名字必须来自 revision.name_snapshot；artist/album、layout、字体 hash、母版 hash 来自抽取 release 的 render_spec，不读取后来修改的草稿。

| 对象 | 固定规格 |
| --- | --- |
| 母版/成片 | MP4，720×1280，恒定 30fps，H.264 Main/High、level≤4.1、yuv420p；AAC-LC 48kHz 双声道；15–30 秒 |
| 成片码率 | 初始目标约 2Mbps；CRF 23、maxrate 2500k、bufsize 5000k；超过 15 MiB 判失败，不无限重编码 |
| 输出文件 | video.mp4、poster.jpg；封面取第 3 秒；moov 位于 mdat 前；移除输入元数据 |
| 文字 | `@napi-rs/canvas` 画 720×1280 RGBA；授权字体；默认白色、黑色 3px 描边，固定 8px 内边距 |
| 姓名框 | x60/y480/w600/h180；48px 起、最低30、最多2行；以已批准 layout 为准，越界拒绝发布 |

固定副标题绘制在母版；headline 仅允许一个 `{displayName}` 占位符，subheadline 只允许 `{artistName}`/`{albumName}`，禁止任意模板表达式/HTML/文件路径。运营文案先审核；测量过长固定文字必须发布前修正。

## 2. 文字算法（S03/S11/S19 共用）

1. NFC、去首尾空白，按共享字素簇分段；拒绝控制/双向/不可见字符与 emoji。使用固定授权字体 cmap 检查每个字符；不允许系统字体默默 fallback。
2. 形成完整 headline。测量包含描边、实际墨迹上下边界与 padding；不能只用字符串长度或字体平均宽度。先试单行，从48递减2到30。
3. 单行放不下，且 maxLines=2：枚举字素簇断点，去掉行首尾空白，拒绝空行；优先合法空格断点，随后选择两行最大像素宽最小的断点。每个字号检查宽与两行总墨迹高度。
4. 按中心对齐绘制；在名字框内留 padding，避免描边裁切。所有候选不合格返回 NAME_INVALID/具体可见提示，不截断名字、不自动换款。测试透明 PNG 的非透明像素边界。
5. 服务端输入校验和所有可抽模板的长名预检使用同一算法；素材/字体变更必须新 variant ID。前端只作即时提示，后端结果权威。

名单夹具：短中文、16 个中文、16 个窄拉丁、16 个宽 W、含空格/中点/连字符、NFC 合成字符、缺字、17 字素、换行、双向符、emoji。后四类按规则拒绝；不得把不可支持字符测试写成成功。

## 3. 合成参数与子进程行为

在服务端以 `spawn('ffmpeg', args, {shell:false})` 运行，args 是数组。文件名为内部生成 UUID，输入只来自已批准对象下载的本地路径；不直接把用户文本或远程 URL交给 FFmpeg。示意参数（实现时构造成数组）：

```text
-hide_banner -nostdin -y -loglevel error
-i master.mp4 -loop 1 -framerate 30 -i headline.png
-filter_complex [1:v]format=rgba,fade=t=in:st=0.8:d=0.6:alpha=1[n];[0:v][n]overlay=0:0:shortest=1:format=auto,format=yuv420p[v]
-map [v] -map 0:a:0
-c:v libx264 -preset veryfast -crf 23 -maxrate 2500k -bufsize 5000k
-profile:v high -level:v 4.0 -pix_fmt yuv420p -r 30 -g 60 -threads 2
-c:a copy -t <经校验的母版秒数> -map_metadata -1 -movflags +faststart video.mp4
```

母版必须先规范化 AAC-LC 后才允许 copy 音轨。主文案0.8秒开始、0.6秒淡入，封面时已可见；这些是项目视觉默认值，不是微信标准。短夹具允许测试专用参数，但正式产物不得短于15秒。

启动前检查 signal.aborted；运行中续租失败或取消立即停止渲染/上传。先 SIGTERM，最多等 2 秒再 SIGKILL；等待 close 才删除临时目录，避免返回 Promise 后子进程仍写文件。超时120秒从本次任务执行开始计，日志截尾且去路径/名字；不把完整 stderr 给客户端。

## 4. 成片检查

`ffprobe` 检查流数量、codec、profile、像素格式、画幅、帧率、时长误差≤0.1秒和文件大小；解码首/中/尾帧，读取 MP4 box 验证 moov 顺序；确认音轨可解码。检查不通过不上传正式引用。对三种姓名预览逐套人工听看，截帧不替代完整音画检查。

对象键用 `renders/{invitationId}/{revisionId}/{generation}-{leaseEpoch}/video.mp4`，poster 同目录。每次领取 epoch 单调递增，generation 新周期递增，不用可归零的 attempts 组成唯一键。上传成功再做最后事务校验；失败对象登记 cleanup 或由带任务状态核对的孤儿扫描回收。

## 5. Worker 提交协议

领取与续租不持有业务父行锁；领取短事务返回 jobId/generation/leaseEpoch/leaseUntil。heartbeat 与最终写回必须同时满足 running、generation、epoch、cancel_requested=false、lease_until>数据库当前时刻。已过期即丢失资格，不因“还没人来抢”允许旧 Worker 续租。

最终事务按用户→活动→邀请函→revision→job/额度/分享顺序锁定；核验用户未删除、活动/资产未撤回、权利和保留期、pending/current 指针、任务租约。成功才原子切换引用、结算预留、撤销旧分享、计划旧文件清理。外部存储调用不能留在此事务内。错过时机即回滚并清理本次对象。

自动最多3次，5秒/30秒带抖动；无效字体/媒体/授权为永久错误。用户点击只唤醒尚有预算的 retry_wait；运营新周期需原因与审计，不无限自动清零。预算按 docs/13 规则释放/结算。

## 6. 实测记录与放行

S03 本地输出 MP4+poster+ffprobe JSON；S04/H04 用真实 AppID 在关闭域名豁免的 iOS/Android 保存，第二微信打开卡片，记录 buildId。不能把固定视频的 M0 当作动态业务完成，G3 仍须走真实 API/队列闭环。

S39 在预计首发模板和真实资源上记录单条 CPU秒、总时长、内存峰值、队列等待、平均 bytes、网络开销。容量按 `目标到达率 × 平均服务时长 / 目标利用率` 估并发，再压测确认；不承诺固定机器配置能支持任意访问量。
