# V1.5-02｜最小领域数据、版本和事务合同

> **状态：工程实施建议稿，待总体审定；2026-10-11。**
> 依据：V1.1 六区边界、PD-001～PD-009、V1.2-03 领域对象、V1.3-11～14 的资产→Shot→Clip→Run→Take→Timeline 流程。
> **不是已批准数据库 DDL**。本文件是供 Codex 工程化的语义/事务合同，没有建立数据库、运行迁移或生成媒体。

## 1. 按最少的部件存储真实影视工程

- **PostgreSQL（建议）**：存作品身份、正式版本、引用、授权、任务、真实结果和来源；使用事务和外键，不把整部电影工程只保存在聊天里。
- **S3 兼容对象存储（建议）**：存不可变的原始图片、声音、视频、分镜画面和 Render；第三方临时 URL 不是唯一长期文件。
- **持久 Worker + Postgres 任务队列（建议）**：上传、模型生成、轮询、下载、媒体检测和 Render；浏览器关掉仍能运行。
- **确定性 Adapter**：真正调用模型的是按服务商/具体模式分别验证的编译器；LLM 负责创作建议，不能随意填 API 字段。
- 不提前要求 Redis、Kafka、向量数据库、六个独立 Agent 或一堆微服务。

## 2. 候选的最小数据表族（名称未定，可合并）

| 模块 | 关键对象/候选表 | 必须成立的关系 |
|---|---|---|
| 剧本 | Project、Film、ScreenplayRevision、Scene、Beat | Scene/Beat 可追到某个正式剧本版本，多集可共享正式设定 |
| 资产 | AssetIdentity、AssetVariant、AssetRevision、AdoptedReference | Identity 与版本分离；Variant 可表示人物 Look、场景环境状态、道具外观状态、声音身份 |
| 媒体 | MediaFile、AssetMediaLink、ProviderUpload | 真实媒体与来自不同渠道的上传 ID 分离，来源/校验和不可丢 |
| 导演 | DirectorShot、ShotRevision、ShotExecutionRevision | 第 3 区创建唯一 Shot，第 4 区细化同一身份 |
| Clip | GenerationClip、ClipPlanRevision、ShotClipSpan、ClipAssetBinding | Shot↔Clip 多对多，映射时间段/镜头边界与固定参考版本 |
| 生成 | CompiledInput、GenerationRun、Take、ContinuationLink、SecondSamplingLink、Job、BudgetGrant、CapabilityProfile | 编译/Run 快照不可变；续接与二采不同关系；付费授权可证明 |
| 成片 | QAFinding、TakeSelection、TimelineRevision、TimelineSegment、RenderJob | 真正 Take/导入媒体可入片；原件不因裁切或改选被覆盖 |
| AI 协作 | Proposal、DecisionRecord | 建议≠已采纳事实；记录差异、权限、版本和影响 |

第一实施切片只实现真闭环所需的表；不要因为表名列出就一次创建全部物理表。可在 PostgreSQL 中混用稳定关系字段与经过结构校验的 JSONB 创作内容，但**Shot/Clip/Run/Take/媒体/版本/父续接**等外键关系必须可校验。

## 3. 四条必须由事务保证的业务不变量

### A. 角色/场景/道具只有一张当前正式完整图板

- Identity ID 持续稳定，Revision 独立且内容写入后不可原位篡改；当前采用指针作为事务更新关系。
- Character + Look 采用一张完整 **2:3 竖幅 2×2**；Location + EnvironmentState 采用一张**上大下三小 1+3**；HeroProp + VisualState 采用一张**1+3**。不为图板中的四格另建四个强制正式 MediaFile 身份。
- 同一 Variant 可以有多个历史候选和被替代版本，但同一时点最多一条 current adopted；必须在持久层保证，不只前端隐藏。
- VoiceIdentity 记录独立的 **baseline_speech_rate（基准语速）**；某句台词的导演速度覆盖和停顿存 ShotExecution/Clip，不回写 VoiceIdentity。
- 临时湿衣、持握、站位、喊叫不是自动新 Look/PropIdentity；导演动作和 ContinuityState 单独记录。

### B. 采用/改版使用乐观并发

1. 创建建议修订时保存其基准版本 R1。
2. 采纳 R2 时检查目前仍为 R1；若已被别人改成 R3，返回明确的版本冲突。
3. 同一事务更新当前正式版本指针 + 采纳记录 + 下游影响通知（可以用 Outbox）。
4. 历史 Run/Take/Render 仍保留真实使用的 R1，不被当前采用指针追着变。

**验收**：两个并发请求分别采纳 Look A 与 Look B，只能一个成功，不能出现两张同时被声明为正式图。

### C. 生成成功不等于有可用 Take

- CompiledInput 冻结 ClipPlan Revision、路由/模式、模型参数、已存在的真实 MediaFile ID/版本、授权来源，以及敏感字段脱敏后的请求快照。
- Run 指向一个 CompiledInput，记录远端任务 ID、状态/错误原始证据、已知费用和时间。
- 远端返回 succeeded 后，要**实际下载并保存持久视频**、检查媒体可解码/有画面/音频/时长等事实，才能建立 media_ready Take。
- 同一个 Clip 可有多个 Run/Take；选片只改变选择/Timeline，不修改原 Run 或原始视频字节。
- 图像接口返回 Base64 也要先真实解码入库、检查文件，才能成为正式资产，而不是只保存生图 Prompt。

### D. 真续接引用父结果和真正 Motion Context

- 规划 B2 续接 B1 **不代表**具备真实父上下文；执行时必须有指定 Run/Take 与服务实际支持的 MotionContextReference、有效性及权限证据。
- 上下文未取得，B2 只能等待/阻断；末帧、参考视频、同一次生成的 second sampling **不能冒充** Motion Context。
- B1-TakeA 改选为 TakeB，旧子链仍关联 TakeA；不得更改历史 ContinuationLink 的父 ID。
- SecondSamplingLink 表示同时间段视频的另一次采样，独立于扩展时间段的 ContinuationLink。

## 4. 时间与复杂镜头的正确表达

- **DirectorShot 不限于 15 秒**；GenerationClip Plan ≤15 秒，且服从具体模型/模式更严格的要求。
- ShotClipSpan 至少有 shot_id/shot_revision、clip_id/clip_revision、Shot 内与 Clip 内时间范围、先后顺序和跨段是否保持导演镜头不切的标志。
- 计划时间与真实媒体时间分开。建议时间段用整数毫秒或分数时间基，实际视频帧率/时长来自媒体检测，不依赖浮点累计。
- TimelineSegment 引用某 Take/导入媒体的 source_in/out 与 timeline_start；裁剪源入出点不能越过真实媒体时长；原媒体不变。
- **必测**：22 秒连续 Shot04 → B1 12 秒 + B2 10 秒；同时 6 秒 Shot01 + 6 秒 Shot02 → 单个 12 秒 ClipA，两种情况都不额外制造导演 Shot。

## 5. 异步 Worker、付款与幂等

建议 Job 持续保存稳定 ID、类型、关联资源、输入摘要、租约拥有者/过期时间、尝试次数、状态、远端任务 ID、费用授权引用、上次错误。Worker 必须支持持久领取/恢复，而非依靠浏览器页面打开。

- 本地 SubmissionIntent 对同一用户提交意图使用唯一约束，防止双击重复排队。
- 收费网关已可能收到请求但响应超时：状态进入 **submission_unknown**，先对账/查询；**不得租约到期后立即自动再发付费请求**。
- 远端成功但媒体下载失败：只重试下载，不重新生成收费视频。
- 用户批准有范围与上限的费用预算。重试和子续接任务也计入同一授权范围；价格不可靠时明确显示未知，不能自行提交。
- 同事务写本地状态 + Outbox 事件，Worker 再安全消费，减少 DB 已提交而任务丢失风险。
- 无依赖 Clip 可并发，真续接等候确切的父 Take/Context；故事顺序不是执行依赖。

## 6. 最小媒体元信息

每个 MediaFile 至少有 ID、持久 object_key、sha256、字节大小、真实格式/MIME、来源类别、访问权限、录入时间和 file_status。图片保留宽高；音频/视频保留检测后的 duration、帧率/时间基（适用时）、编码与实际音轨信息。

ProviderUpload 需记录 MediaFile ID、具体路由、远端上传 ID、渠道/密钥的**非敏感归属标识**和有效期/验证状态。RunningHub 上传 ID 不应拿来冒充标准 MediaFile 或远端生成任务 ID。

## 7. 必须进入 Codex 自动测试的案例

| ID | 测试场景 | 通过判据 |
|---|---|---|
| DATA-01 | 同 Look 两个候选并发采纳 | 只产生一条当前正式版本，另一返回版本冲突 |
| DATA-02 | 场景/道具 1+3 整板采用 | 每个变体只有一个正式整图 MediaFile，无四个正式拆格 |
| DATA-03 | 同角色创建两套 Look | 同一 Character，两个 Look；旧 Run 保留旧版本引用 |
| DATA-04 | 22 秒 Shot → B1 12s + B2 10s | 同一 Shot ID，Clip 时长合法 |
| DATA-05 | 2 Shot → 一个 Clip | 多对多 ShotClipSpan 成立，导演 Shot 不被合并身份 |
| DATA-06 | 调整台词语速及停顿 | VoiceIdentity 的 baseline_speech_rate 不改变 |
| DATA-07 | 更换真实父 Take | 旧 B2 分支保持历史，当前 B2 需重新绑定上下文 |
| DATA-08 | 收费请求响应未知 | 标记 submission_unknown，不自动重复付费 |
| DATA-09 | Run 成功，媒体下载失败 | 不能创建已就绪的假 Take，允许安全重下载 |
| DATA-10 | 同 Take 非破坏裁切并 Render | 原文件 hash 不变，生成新的 Timeline/Render 来源 |
| DATA-11 | 打开已发布的旧 Render | 可以追到当时的剧本、资产、Shot、Run、Take、Timeline 版本 |
| DATA-12 | 第三方 URL 已过期 | 模型预检拒用失效引用，要求找回实际 MediaFile |
| DATA-13 | 无声角色没有样音 | 不自动付费生成；重要对白角色提醒是否需要基础样音 |
| DATA-14 | 续接没有 Motion Context | 子 Run 阻断，首尾帧不能作真续接 |

## 8. 待批准与待实测的内容

具体 ORM、表名、ORM relation、Job 库、分辨率/画幅/清晰度和技术部署可按工程条件调整；**不得因物理表合并而牺牲上述业务不变量**。PD-006～PD-009 图板、语速，以及第 3/4 区同一 Shot 和真正续接的基本语义均保持不变。

**下一份**：[V1.5-03 服务端 API、Provider 与异步任务合同](03-API-PROVIDER-AND-JOBS-CONTRACT.md)。
