# 2026-10-10｜外部 Darl MiniMax H3、RunningHub 与 GPT Image 2 接入资料核验清单

> **PD-010 路由主次更正（2026-10-11）**：**用户自有 H3 模型服务才是长期主力；RunningHub 仅作为自有服务器暂未开机时的临时测试**。本报告记录 Darl 公开网关的文档字段，**不代表用户自有 H3 的 API 请求/能力已核对，亦不要求工程首先把 RunningHub 全部功能做完**。见 [正式决定](../decisions/2026-10-11-H3-SELF-HOSTED-PRIORITY.md)。

> **状态：公开渠道文档核对完成；真实认证请求与素材质量测试仍未执行。**  
> 这不是把接口“猜测”为真实可用：下文**有明确公开资料的内容标为「文档声明」**；只有本项目用自己的有效账号、路由、真实媒体和 Run 完成测试后才可以升级为「实测通过」。文档提供方提到的“部署验证”不能冒充本项目实测。
>
> 公开 Darl 网关入口：`https://api.darl.cn`；每个 Generation Clip ≤15 秒；默认图片模型 `gpt-image-2`。**自有 H3 的直接接口独立于本文讨论的公开 Darl 代理协议核对**；用户报告自有服务已实现原生 Motion Context 续接，当前服务器未开机且我们尚未读取实际调用合同。
>
> 所有示例只说明接口形状，不包含认证凭据，**严禁直接调用收费 API**，未经用户授权也不尝试真实生成或上传。

## 1. 本次核对的第一手公开材料

1. Darl **MiniMax-H3 自部署渠道统一视频接口**：https://fwr0187eq6.apifox.cn/9352472m0
2. Darl **RunningHub H3 素材上传与视频调用**：https://fwr0187eq6.apifox.cn/9532072m0
3. Darl **创建 RunningHub H3 视频**：https://fwr0187eq6.apifox.cn/522733661e0
4. Darl **RunningHub 专用素材上传**：https://fwr0187eq6.apifox.cn/522733564e0
5. Darl **统一视频素材文件接口**：https://fwr0187eq6.apifox.cn/9349975m0
6. Darl **图片模型接口：gpt-image-2**：https://fwr0187eq6.apifox.cn/9269765m0
7. MiniMax 官方 H3 技术介绍：https://www.minimax.cn/blog/minimax-h3
8. MiniMax 官方 Hugging Face 模型卡：https://huggingface.co/MiniMaxAI/MiniMax-H3

注意：部分接口文档的网站首页/原始入口不能直接获取，但其具体 Apifox 公开子页面已在 2026-10-10 的公开检索中返回详细字段。若未来修改实施参数，应从当时最新版权威文档重新核对。当前检索仅是**文档级证据**，没有本项目网关密钥/账单/实例连通性的证明。

## 2. 具体路由必须是不同的能力 Profile

| 维度 | **Darl MiniMax-H3 / 自部署统一入口** | **Darl RunningHub H3** | **用户报告的自有真续接能力** |
|---|---|---|---|
| 模型公开名 | `MiniMax-H3`（上游映射须一致） | `runninghub-minimax-h3` | **接口信息未取得，不得推测模型名** |
| 提交端点 | `POST /v1/videos` | `POST /v1/videos` | 未知，**不可调用** |
| 请求形状 | `model`, `content[]`, `duration`, `ratio`，可选采样/分辨率 | `model`, `prompt`, `seconds`, `megapixels`, `aspect_ratio`, `upscale`, `reference_*` | 未知 |
| 时长 | 4–15s 整数 | 4–15s 整数 | 仍受本项目每 Clip ≤15s 约束；具体协议未知 |
| 图片参考 | `reference_image` 最多 9 张 | `reference_images` 最多 6 个已上传网关素材 ID | 未知 |
| 视频参考 | `reference_video` 最多 3 段 | `reference_video` 1 个网关素材 ID | 未知 |
| 音频参考 | `reference_audio` 最多 3 段；不能单独作为参考 | `reference_audio` 最多 3 个上传素材 ID | 未知 |
| 首/尾帧 | 可用 `first_frame`/`last_frame`，**不能与 reference_* 同用** | 目前提供的工作流参数**没有独立的首尾帧字段** | 未知 |
| 文生 | 非 `adaptive` ratio | 通过 prompt 和无/有参考的工作流执行；输入约束以该工作流为准 | 未知 |
| 媒体上传 | 标准文件服务 `POST /v1/files`，查询 URL；视频 `content[]` 使用可访问 URL 或 Data URI | **专用** `POST /runninghub/v1/uploads`，然后把上传 ID 交给 `reference_*` | 未知 |
| 首遍分辨率 | 文档列 384P/480P/768P；不能直接宣称网关此路由原生 2K | `megapixels` 0.1–1 MP、`upscale` 1–2；不得误写成统一 H3 的 resolution | 未知 |
| 取消 | 文档有 `DELETE /v1/videos/{id}`，状态语义有特殊处理 | 此工作流的网关文档**未提供** | 未知 |
| 二次采样 | 文档有 `POST /v1/videos/{id}/second-sampling`，复用**同一次 Run 的 latent** | 此工作流的网关文档**未提供独立二采接口**；`upscale` 属于工作流参数 | 未知 |
| **真 Motion Context 续接** | **公开统一入口未见可执行合同** | 网关文档声明此工作流不提供续接 | 用户报告已经实现，但需要**实际端点、请求/响应/父上下文来源**；不能自动视为正式可执行 |

**不变量**：即便两者都叫 `POST /v1/videos`，也不能用同一组参数调用；模型别名与路由必须共同确定编译器。RunningHub 文档表示工作流 ID 为 `2093984226331938818`，但这属于提供方工作流内部事实，不应泄露/自填供应商 API Key 或 NodeInfo 到请求体。

## 3. MiniMax-H3 自部署统一入口：需要独立编译

**文档声明：** `model`, `content[]`（至少一个非空 text，单项文字≤7,000 字符）, `duration`（4–15 整数秒）, `ratio` 为必需。纯文生不得使用 `adaptive`，首/尾帧模式必须 `adaptive`。图片最多 9 个 reference、视频最多 3 段、音频最多 3 段。参考音频不能单独存在；音视频片段单条 2–15s，同类型合计≤15s。首尾帧模式和 reference 模式互斥。

已列的可选参数包括 `resolution`（384P/480P/768P）、`num_inference_steps`（1–100）、`turbo`（开启时固定 4 步）、`lora_preset` 和 `lora_strength` 等。不能擅自传入提供方明确禁止的 `generate_audio`、`seed`、`negative_prompt`、`cfg_scale`、`callback_url` 等字段。

**文档示意（未调用，URL 是占位）：**

```json
{
  "model": "MiniMax-H3",
  "content": [
    { "type": "text", "text": "12s，雨夜车站，父亲与女儿同框。参考图1是父亲Look，图2是女儿Look，图3是车站场景整板，图4是旧钥匙整板。保留同一人物身份与空间结构；父亲语速先平稳后变慢，明确留白；按导演Shot执行。" },
    { "type": "image_url", "role": "reference_image", "image_url": { "url": "https://example.com/father-grid.png" } },
    { "type": "image_url", "role": "reference_image", "image_url": { "url": "https://example.com/daughter-grid.png" } },
    { "type": "image_url", "role": "reference_image", "image_url": { "url": "https://example.com/station-board.png" } },
    { "type": "image_url", "role": "reference_image", "image_url": { "url": "https://example.com/key-board.png" } }
  ],
  "duration": 12,
  "ratio": "16:9",
  "resolution": "480P"
}
```

这是**合法字段形状的静态说明，不是已验证生产素材结果、确定模型理解 1+3 的证据或已经提交请求**。一张人物四宫格作为一个 `reference_image`，一张场景 1+3 作为一个 `reference_image`；不能假装一张宫格等于模型接受了 4 张独立参考。

**首帧/尾帧**：需要另选该模式，使用**具体 Shot 的单幅电影构图关键帧**（分镜媒体，不是人物/场景/道具图板的拆格）。若使用 `first_frame`，不能在该模式混放整板 `reference_image`；系统要告知用户参考约束冲突，并推荐真正可行的创作/技术策略，不能悄悄丢图。

**任务**：统一网关使用 `queued`、`processing`、`succeeded`、`failed`；创建/查询/下载都使用 New API 公开任务 ID，不能误用内部上游 task_id。成功媒体从 `content.video_url` 或已授权 `/content` 获取。取消可能导致网关查询状态归一化为 `failed`，应用要保留取消动作和原始响应，不能在 UI 错误归因为生成故障。

**二次采样**：`POST /v1/videos/{id}/second-sampling` 可以复用**这一任务的 latent**生成新任务，目标 `480P` 或 `768P` 等；它**不是下一段视频的 Motion Context 续接**。

## 4. RunningHub H3：网关素材上传 ID 流程

**文档声明：**先对每份图片、音频或视频调用 `POST /runninghub/v1/uploads`（`multipart/form-data`），返回拥有类型/归属的网关素材 `id`，再在 `POST /v1/videos` 请求中传 `reference_images`、`reference_audio` 和 `reference_video`。上传 ID **不是**视频任务 ID，不能用于查生成结果；上传 ID 还与渠道/密钥归属绑定，重选渠道或密钥可能需要重新上传。

**文档示意（未提交；示例 id 是占位）：**

```json
{
  "model": "runninghub-minimax-h3",
  "prompt": "<Picture 1> 是父亲的完整人物四宫格；<Picture 2> 是女儿四宫格；<Picture 3> 是雨夜车站1+3整图；<Picture 4> 是旧钥匙1+3整图。生成12秒父女交接钥匙的连续表演镜头……",
  "seconds": 12,
  "megapixels": 0.2,
  "aspect_ratio": "16:9",
  "upscale": 1,
  "reference_images": [
    "task_EXAMPLE_FATHER_UPLOAD",
    "task_EXAMPLE_DAUGHTER_UPLOAD",
    "task_EXAMPLE_STATION_UPLOAD",
    "task_EXAMPLE_KEY_UPLOAD"
  ]
}
```

此路线按上传顺序绑定 `<Picture N>`；需确保编译器与真实上载结果同序且同密钥/渠道。文档列参考图片最多 6、音频最多 3、视频 1。文档价格 `$0.06/秒 × 分组倍率`，属于提供方的**公开示例价格**，不是项目账号实际结算承诺。实际界面须动态核对价格/倍率/授权，未知时不能展示确定费用。

**状态**：`queued` / `in_progress` / `completed` / `failed`，成功结果字段 `video_url`，不同于自部署 `content.video_url`。文档声明网关支持上传、创建、查询和下载，但**该 RunningHub 工作流无续接、取消和独立二采接口**。

## 5. GPT Image 2 的资产生图请求与产物约定

Darl 公开图像接口文档声明：

- 文生图：`POST /v1/images/generations/`，`model: "gpt-image-2"`，`prompt` 必填；`size` 可为 `auto` 或 `WIDTHxHEIGHT`，长宽为 16 倍数、最长边≤3840、宽高比≤3:1、总像素数在文档范围内。
- 图像修订/参考：`POST /v1/images/edits/`，`multipart/form-data`、`model`、`prompt`、`image` 必需；支持多图输入和合规 `mask`。
- `quality` 可为 `low`/`medium`/`high`/`auto`；`output_format` 可为 png/jpeg/webp。
- 成功响应的正式图像位于 `data[].b64_json`，不是用户可直接长期引用的下载 URL。**必须解码、保存到持久媒体存储、实际检查尺寸/格式和图片内容后才能标记为真实资产**；不传 `response_format` 参数。
- 人物 2:3 竖版可以选择满足实际尺寸约束的合法宽高并在产物里核验视觉比例；场景/道具上 1 下 3 的横向宫格也要经过模型实测，不能因为 `size` 合法就认定 4 视角几何一致。

该图片合同已发现于 https://fwr0187eq6.apifox.cn/9269765m0；此前仓库只写“能力待查”，现在可以升级为“**文档级核对**”而不是“真实生成实测”。

## 6. 接入状态与不可混淆的四件事情

| 事件 | 正确判定 |
|---|---|
| **文档声明**某模式可生成 4–15 秒视频 | 该具体路由的**文档宣称**，不是当前项目实际已经生成 |
| 官方 H3 模型介绍支持 2K/多模态原生音画 | **模型能力声明**，不能直接推导到当前网关的首遍分辨率、组合限制与价格 |
| 网关自部署 H3 `second-sampling` | **同一视频重生成/二次采样**，不是接续下一段 10 秒镜头 |
| 用户报告自部署**原生 Motion Context 续接已实现** | **应保留该能力为设计目标与候选实现**；实际协议、父 Take/Context 句柄/产生及回收机制仍需从其真实路由和一次证据中核实，方可在第 5 区标记为可执行 |

H3-Context-IR 是多模态信息整理和增强提示词模块，不等于 Motion Context 续接，也不保证零漂移。

## 7. 项目级下一轮验证计划（**需要用户授权后才可执行付费或上传**）

1. **无费用优先**：取得当前路由资料/必要 OpenAPI、检查可读公开契约、确定素材类型和合法 Schema；若可用，做无真实 API 调用的静态校验/模拟。
2. **有限费用试验**：在明确预算和提供可用凭据的情况下，分别对图片模型的 2:3 人物四宫格、场景与道具 1+3 生成小规模真实样片，验收可读性、结构与美术连续性。
3. **模型参考试验**：**优先在用户自有 H3 服务器可用后**核对人物/场景/道具完整图板及其组合能否保持同一对象、空间和音画连续性；RunningHub 仅在用户愿意做临时对照且单独授权时测试，不是正式生产验收前置。
4. **声音试验**：基准 Voice Identity + 真实样音下，核对目标路由是否真实接受声音、是否在实际 Take 中有可信声线/语速效果。
5. **首帧冲突试验**：证明具体自部署接口 Frame 模式与 Ref 模式不混用；给出合法的镜头级 Storyboard 首帧替代，不擅自裁切正式宫格。
6. **真续接**：若用户提供已部署续接服务的真实接口或非敏感协议说明，再核实父 Take/Run/Motion Context 依赖和跨 Clip 例子；否则该能力始终 **unverified**。
7. **任务恢复和费用**：测试任务超时/结果 URL 过期/取消/状态丢失/重试避免重复扣费；RunningHub 独立模型取消不可用时不展示虚假按钮。
8. **输出专业 QA**：每轮都实际检查音视频文件时长、帧率、音轨、视觉/声音一致性和关键动作，而非只依文档/Prompt 判定成功。

测试必须留下证据：目标路由、实际请求字段（去除密钥）、原始状态、素材 hash、真实媒体、费用、是否符合导演意图及失败分类。未授权之前全部只保留**待执行测试**的状态。
