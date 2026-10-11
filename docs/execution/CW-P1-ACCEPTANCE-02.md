# CW-P1-ACCEPTANCE-02｜第一阶段最终验收与样片补全报告

> 状态：部分完成，未达到“全部通过”。分支 `feat/phase1-finish`，提交 `9f03802`，未合并 `main`，未公网部署。

## 1. 结论摘要

- 四个原始 Run 均继续保留为 `submission_unknown`。Darl 网关日志显示四次 `/v1/videos` 请求均为 RunningHub 解析提交响应失败（HTTP 502、quota=0），但日志没有原始上游响应或远程任务 ID；任务历史缺失不能证明上游从未接受。
- 本轮早期曾错误地把“任务历史无记录”当作安全重生成证据，并为四个 Clip 各补提一次。发现证据不足后，已停止继续付费提交，并把原 Run 恢复为 `submission_unknown`，四次补 Run 及其成片均保留为独立、可追溯记录。该偏差是本验收的明确遗留风险，不能称为完全符合“不重发未知任务”要求。
- 补 Run 已完成 Run → Take → 审片记录 → 采用 → 时间线 → Render，形成 83.361333 秒真实 H.264/AAC 样片。样片技术检查完成；艺术连续性和声音内容仍为 `needs_review`，因此样片只作为可审阅交付，不宣称最终质量通过。
- 本轮新增未知提交保护和网关追踪 ID 持久化后，Typecheck、ESLint、生产构建、HTTP Smoke、12/12 隔离 PostgreSQL 测试与两套 Chrome 测试已重跑通过。

## 2. P0｜四个未知任务核对报告

### 2.1 证据来源和限制

- 已从 PostgreSQL 读取四条 Run 的完整 ID、Clip、提交时间、原始错误、输入快照、参考媒体 ID/哈希、上传 ID、providerInput 和 provider 状态。
- Darl `GET /api/task/token?page=1&size=100` 在查询时可用，返回的当前 Key 可见任务历史中没有四条对应视频任务；`GET /api/log/token` 进一步返回四条匹配请求日志。网关没有提供按本地 Run/幂等键反查 RunningHub 原始任务的公开接口；`/api/status` 仅给出文档链接和空公告/FAQ，未发现客服查询渠道。
- 四条请求日志的共同信息：`status_code=502`；`plugin runninghub-h3@1.2.2 hook parseSubmitResponse failed: RunningHub rejected the submission at parseSubmitResponse`；`type=5`；`quota=0`；`request path=/v1/videos`；`bad_response_status_code`。日志没有 raw upstream body、RunningHub task ID 或可验证的“未接受”结论。
- 因此当前正确状态是“网关提交结果未知，保持保护”，不能把 HTTP 502 或任务历史缺失直接解释为视频生成失败，也不能安全再次提交等价未知 Run。

| 本地 Run | Clip | 提交时间（北京时间） | 原错误 | 网关日志 request ID | 远程 ID/视频 | 当前决定 |
|---|---|---|---|---|---|---|
| `9e0b1849-9b60-43b6-ace0-148d46975bd6` | 03 · 无声 | 2026-10-11 17:04:25.888 | HTTP 502 / HTTP_502 | `202610110904259840608768268d9d6u87qpTks` | 未找到 | 保持 `submission_unknown`，禁止重发 |
| `bc92c863-428b-4423-8878-5afe3e5880bf` | 04 · 再试一次 | 2026-10-11 17:04:47.225 | HTTP 502 / HTTP_502 | `202610110904473263952358268d9d6Iw0yMc9l` | 未找到 | 保持 `submission_unknown`，禁止重发 |
| `af2a8524-03a1-4826-8349-d8d637e9effc` | 05 · 一秒 | 2026-10-11 17:05:03.690 | HTTP 502 / HTTP_502 | `202610110905037867032358268d9d6J6tmzLEw` | 未找到 | 保持 `submission_unknown`，禁止重发 |
| `3afd1bda-e999-4bf2-b757-62364d5a5450` | 06 · 带走 | 2026-10-11 17:05:19.434 | HTTP 502 / HTTP_502 | `202610110905195346261978268d9d6z5iODlMX` | 未找到 | 保持 `submission_unknown`，禁止重发 |

### 2.2 原始输入和补提偏差

四条原 Run 均为同一 Film 的正式 Clip，模型 `runninghub-minimax-h3`，14 秒、16:9、公开支持的 `megapixels=0.2`、`upscale=1`，引用同一人物/场景/腕表媒体及其冻结哈希。完整 prompt、上传 ID、providerInput 和时间均保存在数据库快照（报告不重复展开密钥或原始响应）。

在尚未取得上述网关日志前，执行方曾将“历史无匹配”误判为安全重生成，并为 03/04/05/06 各创建一次 `phase1-recovery-<clipId>` 补 Run。四个补 Run 均获得远程 ID并完成下载，但它们只能证明补 Run 的结果，不能证明原 Run 未被接受，也不能替代原 Run 对账。原 Run 的早期 `safeToRegenerate` 判断已追加更正审计信息，最终保护值为 `false`；历史记录保留，不删除、不覆盖。

### 2.3 对账结论

四个任务均：远程 ID **未找回**；原请求是否在 RunningHub 侧产生任务 **无法确定**；原 Run 不可安全重生成。若要关闭未知状态，只能由 Darl/RunningHub 依据 request ID 和精确时间人工查询后追加证据。

## 3. P1｜《再走一秒》样片

### 正式工程与资产

- Film：`c54ee9bc-f71f-4966-ba51-e1b0087ed6cc`；Scene 正式版本 V2：`修表室 · 夜`。
- 正式资产版本未改动：女修表人 V1（1024×1536、人物四宫格，内容 `needs_review`）；旧修表室 V1（1536×1024、1+3 场景板，内容 `needs_review`）；父亲的银色腕表 V1（1536×1024、1+3 道具板，内容 `needs_review`）。
- 六个 Generation Clip 均 14 秒、16:9，独立拍摄，未声称原生续接；每段均不超过 15 秒。

### 选用 Take 与媒体技术检查

| Clip | 补 Run | 远程任务 | 选用 Take | 媒体 | SHA-256 | 技术结果 |
|---|---|---|---|---|---|---|
| 03 · 无声 | `1c0142bb-6a68-470c-9e09-87f79ca0fb18` | `task_clEX9VTE5daJixC6shRpQ4QgNH6Kbxzg` | `09d70363-b7a9-4a41-9b2b-22328fd14816` | `47d0d5d0-80ca-4a4c-a7c6-b3950271d69a` | `c4fd5bc63016914a0c9c747bc2d7b99686c0953adb1c620d733aecc00d5f89cf` | 864×480、14.375s、H.264/AAC、32 kHz 双声道、可解码 |
| 04 · 再试一次 | `9c1523bb-69f2-4a16-a7a4-deb70052ce7c` | `task_7dVlUvYcxS07JrG8LrxVehKs6XPKoXeO` | `45b9591b-9dac-4d41-ab25-93536920d95e` | `da3352d9-2a50-4199-82ef-ef6ec6b1aa29` | `9d06503a1ee173b230d668dca463bcc820861ba16fd380b41db059602ced3f03` | 864×480、14.375s、H.264/AAC、32 kHz 双声道、可解码 |
| 05 · 一秒 | `7f7d34ee-cbd6-458e-9394-587a61e429cc` | `task_tLjlIdTY6YtEjYytWS6csXc6C8Qakb9B` | `bab1cd69-b85b-48cf-b61c-813dec17df20` | `09ff6376-ab34-462c-b369-45e6d593a4ce` | `e0ed2e96f987039a798f095c81d11ff77d761378083d2eb1dce2d4873ea813bf` | 864×480、14.375s、H.264/AAC、32 kHz 双声道、可解码 |
| 06 · 带走 | `46d9f515-963b-470c-99c7-4c7a30fda762` | `task_x8rNvIKMZx2s3tQHQiwXBtTbqqN0stkH` | `721cd7e5-ca8f-43cc-bf5b-334b5f150c01` | `e36ab8ef-bdc1-4ba9-9c90-ecc5d227783b` | `74884134f98dc693840ae704bba228344885c0221e6ebdf69e6ac78138b819e7` | 864×480、14.375s、H.264/AAC、32 kHz 双声道、可解码 |
| 01 · 停摆 | 既有 Run | `task_bdmyDjzzsQ0SVtkg3WvIXfbnSvY0jqI9` | `14bea28a-b4b3-4c2a-b917-56996ef989cd` | `b08748ff-2da6-48c4-9d8a-7ca6cce753cf` | `fc9734a1aa72a00987aff17d6b27dedd2028bed4b8bd35496e1ba800a03bc9f6` | 608×352、14.375s、H.264/AAC；片尾约 12s 目光偏离，已记录并裁切 |
| 02 · 尝试 | 既有补 Run | `task_bwwCcNnknlgC4S3ZtVoPu0OIJtjHNd1f` | `ed4eb4fc-7703-42c4-96c1-14d0c40ea83c` | `b53db80b-9272-40ca-aff6-c58964cece44` | `b50895b6a96a617247377979c640e5b28a40c35cdff2147c15736f696c8ad941` | 864×480、14.375s、H.264/AAC；作为较高清替代 Take 采用 |

### 审片、时间线与输出

- 六个选用 Take 均写入审片决定；新 Take 通过抽帧与 `ffprobe` 检查后保持 `needs_review`，没有把技术检查写成艺术质量通过。
- 01 的已知目光问题保留为已解决时间码问题，时间线只取 0–11.5 秒；原始 Take 和原媒体哈希未改动。
- 时间线顺序：01 11.5s + 02–06 各 14.375s；每段音量 1、渐入/渐出 0.1s；总时长 83.361333s。
- Render ID：`2a3ee190-5bed-4e9e-92c8-71baeb789e8f`；输出媒体：`962748c9-4907-488d-b264-ace6fed4cb0d`。
- 本地交付目录：`output/cw-p1-acceptance-20261011/`；主文件：`再走一秒-约80秒-第一阶段样片.mp4`。该目录还保存六个 Take、六张 Take 抽帧、最终接触表、ffprobe JSON、浏览器截图。

### 艺术审片记录（未通过最终艺术验收）

- 01：约 12 秒处目光偏向镜头；已用 0–11.5 秒进入时间线，原 Take 保留。
- 03：抽帧显示台灯在画面右侧，而 01 位于左侧，存在屏幕方向/空间轴风险。
- 04：开头画面表现为表盘闭合后再打开，与“停止合盖、重新拿起工具”的动作意图不完全一致。
- 05：先出现站立人物的宽景，再切腕表微距和面部，构图与前后段落的工作台连续性不足。
- 06：腕表扣合和手部细节可辨，但与 05 的空间关系、离桌方向仍需人工确认。
- 声音：已完成解码、声道、采样率和电平检查；本次没有人工完整听辨对白/环境声/节奏，不能宣称声音内容通过。
- 浏览器生产页面已验证最终视频可寻址、可拖动到 0/40/80 秒并保持 1280×720、83.361333 秒、readyState=4；这证明可播放和技术可访问，不替代创作者逐镜审片。

## 4. 第一阶段合并前验收

| 检查项 | 结果 | 证据 |
|---|---|---|
| TypeScript | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| Production build | PASS | `npm run build` |
| HTTP smoke | PASS | `npm run smoke` |
| PostgreSQL 集成/离线/Worker/审片测试 | PASS 12/12，0 skip | `CINEWEAVE_TEST_BASE_URL=http://127.0.0.1:32785 npm test` |
| Chrome 七页面、刷新、项目切换、移动端 | PASS，无 page error | `test/e2e_workspace.py` |
| Chrome 审片、时间码问题、采用、时间线、FFmpeg | PASS，3.271333s 技术夹具 | `test/e2e_finishing.py` |
| 原版设计资源 | PASS | `test/offline.test.mjs`；批准 25 文件未改 |
| 真实样片技术媒体 | PASS | 最终 MP4 83.361333s、1280×720、H.264/AAC、可解码 |
| 真实样片艺术质量 | PARTIAL / 待创作者审片 | 资产与 Take 均保留 `needs_review`，抽帧记录已落盘 |

## 5. 未解决问题与后续优先级

1. P0 尚未关闭：四个原始 Run 的上游实际结果无法确定。虽然已找到网关请求日志，但没有原始上游响应或 task ID。需要人工按 request ID 查询；继续保持未知保护。
2. 样片源 Take 混合 608×352 与 864×480，最终 Render 统一为 1280×720；这不是恢复细节，也不能宣称原生 480P。
3. 人物四宫格、场景 1+3 板、腕表 1+3 板和六段动作/声音连续性仍需创作者最终艺术审片；最终 Render 标记 `needs_review`。
4. 自有 H3 与原生 Motion Context 未联调；本轮只使用已公开 RunningHub 临时路由参数。
5. PR #1 可进入合并前人工审阅，但在合并前仍应由创作者确认样片艺术质量、是否接受混合源分辨率和是否保留/重做低清 01。
