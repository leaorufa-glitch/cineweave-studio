# V1.5-03｜业务 API、模型适配与可靠任务合同

> **状态：供 Codex 实施的逻辑接口草案；2026-10-11。不是已部署/实测的服务。**
> 上游：[数据与事务](02-DOMAIN-DATA-AND-TRANSACTION-CONTRACT.md)、[第 5 区生成](../v1.3/13-H3-GENERATION-ENGINE-AND-RUN-LIFECYCLE.md)、[公开路由核验](../integrations/H3-ROUTE-CAPABILITY-AUDIT-2026-10-10.md)。
> 目的：让前端、业务层、异步 Worker 和第三方模型有**可自动测试**的交接约束；路径与字段名称只是 V1.5 推荐实现，并非用户已批准的最终 OpenAPI。

## 一、API 设计的五个不可退让点

**PD-010 路由主次**：**用户自有 H3 是生产主力**，服务器目前暂未开机；RunningHub 只是按需启用的临时测试渠道，**不要求首批开发完整适配，也不作为自有 H3 上线的前置**。Darl 公开“自部署 H3”代理接口不能代表用户自有部署的实际请求合同。见 [正式决定](../decisions/2026-10-11-H3-SELF-HOSTED-PRIORITY.md)。

1. 六个工作区用**统一正式工程数据**；AI 建议只有被采纳后才影响正式对象。
2. 前端不直接持有聚合网关 API 密钥，不直接提交收费 H3，不把外部生成任务状态当作本地作品真相。
3. 所有正式修改以版本号或 expected_revision_id 做乐观并发检查，冲突返回明确的 409。
4. 生成有**预检 → 合法编译 → 费用授权 → 后台提交 → 真实媒体 → 审片**的明确分界；无法验证某环节不得称“已完成”。
5. 同一输入计划可选择不同 Provider/Profile，但编译器必须按**具体路由和模式**分别处理；禁止一个 H3 通用 JSON 混用所有参数。

## 二、推荐最小业务接口（路径仅作实施约定候选）

| API | 方法 | 请求/结果的要点 | 行为限制 |
|---|---|---|---|
| /api/films | POST / GET | 新建/查询 Film/可选 Episode 与状态 | 允许从已存在剧本/媒体进入，不强制从空白开始 |
| /api/films/{filmId}/screenplay-revisions | POST / GET | 保存剧本修订/查询基准、正式/候选版本 | AI 提案与正式采纳分开 |
| /api/revisions/{revisionId}/adopt | POST | expected_revision_id，采纳原因，可追溯 Decision | 冲突 409，历史不覆盖 |
| /api/media | POST | 创建上传/接收元数据，返回上传意图与权限 | 必须真实上传并技术检查，不以描述文本冒充媒体 |
| /api/media/{id} | GET | 真实媒体状态、技术属性、访问策略、来源 | 提供限时访问，不返回对象存储或网关凭据 |
| /api/assets | POST / GET | Character/Look、Location/State、Prop/State、Voice 身份 | 不创建四个宫格子图正式资产 |
| /api/assets/{id}/revisions | POST | 修改视觉/声音候选版本，关联真实媒体 | 基准语速独立，剧本临时情绪不是新声音身份 |
| /api/shots | POST / GET | 第 3 区创建 Director Shot、获取当前版本 | Shot ID 唯一而稳定 |
| /api/shots/{id}/execution-revisions | POST | 第 4 区补分镜、表演、对白时序、参考与连续性 | 不创建第二套 Shot |
| /api/clips | POST / GET | 创建 ≤15 秒 Generation Clip 和 ShotClipSpan 映射 | Clip 不强制与 Shot 一对一 |
| /api/clips/{id}/validate | POST | 返回缺失/不兼容输入、导演约束冲突与成本风险 | 不付费，不自动丢正式资产 |
| /api/clips/{id}/compile | POST | 指定 route_profile_id/mode 与冻结输入版本，返回 preview/diff | 不执行生成；生成数据具有不可变快照 |
| /api/budgets/grants | POST | 用户授权模型范围、次数、金额上限、过期与自动重试边界 | 不从模型 Prompt 猜用户授权 |
| /api/generation-batches | POST | 以预先校验的 compiled_inputs、BudgetGrant 及唯一提交意图入队 | 网络重复提交只创建一个本地批次；实际外部幂等另验证 |
| /api/jobs/{id} | GET | 本地 Job、远端状态、输入摘要、当前阻塞原因 | 页面刷新仍可恢复查询 |
| /api/runs/{id} | GET | 路由、脱敏请求/响应、生成记录、已知费用、原始状态 | 远端 succeeded ≠ 媒体 ready |
| /api/clips/{id}/takes | GET | 实际媒体候选、版本来源与真实质量状态 | 一 Clip 多 Take，不覆盖 |
| /api/takes/{id}/review | POST | 时间码 Finding、评分说明、采纳/拒用决定 | 不因 AI 自述“合格”就强制采用 |
| /api/timelines/{id}/revisions | POST / GET | 非破坏性 Segment、顺序、入出点、声画处理 | Segment 引用源 Take/Media，原件只读 |
| /api/renders | POST / GET | 冻结 TimelineRevision + RenderProfile、任务、结果与 QC | Render 大于 15 秒合法；导出后要真的校验文件 |

推荐只实现 UI 真正用到的接口子集，不为完整 API 文档先创建全部空路由。外部路径调整时必须保持上述业务语义并更新契约测试。

### 2.1 常用响应结构

- **成功**：resource_id、revision_id、status、source_refs、下一步可用动作；如有媒体，返回安全的可播放地址或获取方法。
- **409 CONFLICT**：current_revision_id、expected_revision_id、changed_fields_summary；UI 允许重新比较/编辑，不 silently overwrite。
- **422 VALIDATION_ERROR**：field_path、rule_id、actual、expected、recommended_fix；包括时长、缺媒体、模式互斥等。
- **403 NOT_AUTHORIZED**：费用/凭据/作品权限不足；不进入外部收费提交。
- **424 DEPENDENCY_NOT_READY**：需要父 Take/Context、缺 Provider 上传等；保留精确阻断来源。
- **503 PROVIDER_UNAVAILABLE**：服务商不可用，和“已提交但远端结果未知”必须区分。

要为“提交已可能生效但回包丢失”的情况独立保存 submission_unknown；不能将它当作普通 503 自动扣费重试。

## 三、Provider Adapter 的推荐接口边界

推荐内部接口按功能而非模型名称组织：

- describeCapabilities(route, mode)：返回有证据版本的模式能力、时长/画幅/素材限制、冲突规则及字段约束；
- prepareMedia(media_id, route_profile)：检查持久文件、有效 URL 或专属上传 ID；返回真实的素材引用和来源；
- compile(execution_plan_revision, references, route_profile)：只输出合法且可审阅的 CompiledInput，不调用付费服务；
- validate(compiled_input)：按确定性规则检查参数、模式和上传引用；
- submit(compiled_input, authorization)：保存唯一 SubmitIntent 后才能对外提交；
- poll(remote_task_id)：映射本路由原始状态到内部状态，保留原始响应；
- fetchAndPersistOutput(remote_task_id)：下载到持久媒体、校验真实字节/时长/音轨；
- cancel(remote_task_id)：**仅支持有明确文档和实测能力的路由**；
- secondSample(parent_run_id)：**只针对支持的同一次视频重采样路由**；
- continueFromContext(parent_take_id, motion_context_id)：**只针对已核实真实原生续接协议的专用适配器**。

不应默认每个 Adapter 都能实现最后三个能力；未支持要返回显式 unsupported，不应空实现却展示成功。

### 3.1 主生产适配器与可选临时路由（证据级别必须分开）

| 优先级 / 类别 | 编译形状 | 素材准备 | 当前情况与职责 |
|---|---|---|---|
| **第一优先：用户自有 H3** | **自有真实部署协议尚待开机核实，不得照搬公开代理字段** | 按自有服务器实际媒体/参考/Context 机制实现 | **正式生产目标**，设计阶段先 Mock、构建父 Take/Motion Context 原生续接接口；服务器开机后联调 |
| **可参考的公开资料：Darl 自部署 H3 网关** | 文档 model=MiniMax-H3，content[]、duration/ratio | 文档支持其规定的 URL/素材 | 仅是**该代理渠道的文档事实**，不是自有服务器已实现相同 API 的证据 |
| **可选临时测试：Darl RunningHub H3** | 文档 model=runninghub-minimax-h3、prompt、seconds、reference_* | 专用上传返回属于该渠道的素材 ID | 服务器未开机时可酌情用于短期验证，**不做长期主路线或发布阻断项**；没有公开真续接接口 |

图片服务建议独立 ImageAdapter：GPT Image 2 生成及编辑，返回的 Base64 入库，并经人物 2×2、场景/道具 1+3 真图 QA 后才成为正式参考。以上参数详见公开接口核验文档；**文档公开参数不能替代实际账号/能力/输出试验**。

### 3.2 模式能力矩阵需要携带证据级别

建议每条能力至少存：route_id、model_id、mode_id、capability_key、declared_value、verified_level、verified_at、source_url、test_run_id（有实测才有）、notes。

证据级别可用：UNVERIFIED、DOCUMENTED、SCHEMA_TESTED、ACCOUNT_CONNECTED、MEDIA_TESTED、PRODUCTION_APPROVED。对于“真续接”不能因为普通 H3 已经 ACCOUNT_CONNECTED 就连带升格为 MEDIA_TESTED。

## 四、异步任务和真实费用边界

### 4.1 一个批次的推荐任务阶段

**Validate → Compile → Authorization → Prepare/Upload Media → Submit Run → Poll → Download → Probe Media → Create Take → Review → Optional Render**。

每阶段都有独立业务状态与可重试条件：

| 失败位置 | 能否重试 | 何时不能自动继续 |
|---|---|---|
| 缺正式图板 / 声音素材 | 用户补足或专业改变方案后再试 | 不得自动伪造图板、丢引用 |
| 图片/音频上传暂时失败 | 有限次数重试上传；若素材 ID 已有效可复用 | 密钥/渠道变化、来源无授权 |
| 收费视频 Submit 请求响应超时 | **先确认是否已提交**，人工或安全对账后才决定 | 不能直接自动重提，避免重复花费 |
| 远端报告失败 | 按实际错误类型及授权剩余额度判定是否重试 | 参数本身不合法时不可盲重试 |
| 远端成功但媒体下载失败 | 重试下载和入库，不重新付费生成 | URL 已过期需查找合法取回接口 |
| 媒体技术合格但表演错误 | 返回导演/分镜/参考/编译问题分类 | 不因 Run 成功就自动加入成片 |
| 子 Clip 续接缺 Context | 等待/拒绝原生续接 | 不改成尾帧引导却仍标原生续接 |
| Render 中源 Take 已不可访问 | 暂停 Render，修复真正的文件引用 | 不导出缺段但显示成功 |

### 4.2 提交与对账

- 本地批次与 SubmissionIntent 使用唯一业务键避免用户双击或 Worker 重启重复创建。
- 调用付费远端前持久化脱敏 CompiledInput、授权、Attempt 和初始时间；写入费用预留（如必要），避免先付费后找不到 Run。
- 网络超时后立即落 submission_unknown，在能够用远端任务 ID 或服务方可用查询机制核实时才继续。网关**没有已验证幂等键时，不得声称外部请求天然 exactly-once**。
- 上传 ID 与 Run task ID 两类不同；调用返回后将真实远端 ID 尽快持久保存。
- Worker claim/lease/heartbeat 可采用数据库事务，任务崩溃可恢复；但提交未知的收费请求要被更严格地锁住，避免租约过期触发重复收费。

### 4.3 预算控制与权限

仅在用户明确授权一定路由、最大可花费、时间/次数和允许重试后发起付费请求。向用户展示已知的价格依据/未知范围，若无可靠估计不编造单价；无法计算安全最大费用的任务应阻止自动批量启动。用户既可以授权单条任务，也可批准有界批次，以减少反复确认。

**V1.5 工程准备阶段**禁止上传私有素材或发起收费生成；不要将用户 Key 写进仓库、前端、日志或样例请求。

## 五、UI 必须反映真实状态

至少显示：计划时长、正式资产绑定与版本、实际提交图片/音频引用及被排除原因、H3 路由/模式、收费授权、Run/任务状态、媒体是否已经下载、Take 审片、是否需要父 Motion Context、当前生成成本。

- 首尾帧和多参考冲突必须在提交前解释，而不是直接“生成失败”后才发现。
- “已完成”应指清楚：**远端任务完成 / 媒体就绪 / Take 被采纳 / 成片导出通过**，不能都用一个绿色标签。
- 真续接的计划可以出现，但未经实际协议测试不显示“可执行真续接”。
- 第 6 区能基于源媒体时间码追踪错误，用户能从错误跳转到 Clip Plan/Shot/Asset 版本。

## 六、接口/Job 自动化验收（供 Codex 转测试）

| ID | 输入场景 | 预期 |
|---|---|---|
| API-01 | 两个浏览器同时采纳同一资产不同版本 | 一方成功，一方 409，旧 Run/Take 引用不变 |
| API-02 | 以同一 Idempotency-Key 重复创建本地生成批次 | 只创建一个批次/SubmitIntent，不重复入队 |
| API-03 | 无费用授权尝试提交视频 | 返回 403 或明确 waiting_authorization，远端 Submit 未执行 |
| API-04 | 自部署 H3 Reference 和 first_frame 混传 | Validate 返回 422，指出互斥；不调用模型 |
| API-05 | **如果启用临时 RunningHub Adapter**，将普通 URL 当成专用素材 ID | 拒绝，要求合法的渠道上传；**未启用时这项测试不阻止自有 H3 开发** |
| API-06 | 使用相同完整宫格作为不同路由参考 | 媒体 ID 相同但 ProviderUpload 按渠道独立，不拆正式图板 |
| API-07 | 无 Motion Context 却声明 native continuation | 424 或 waiting_motion_context，真续接 Submit 不执行 |
| API-08 | 远端 success 但视频下载/解码失败 | Run success + media not-ready，Take 不进入可选列表 |
| API-09 | Run 提交超时且不知是否扣费 | submission_unknown，不自动发第二次 Submit |
| API-10 | 自部署取消请求最后返回 failed | 保留“用户主动取消”的实际操作证据，不简单归因生成失败 |
| API-11 | RunningHub 临时 Adapter 未启用或无取消接口 | 不展示不存在的取消成功动作；该可选路由不构成发布阻断项 |
| API-12 | 同 Run SecondSampling 与 B1→B2 真续接 | 两种关系分开，二采不能增加影片时长 |
| API-13 | 页面刷新/Worker 重启 | Job、远端 ID、预算与媒资状态继续恢复 |
| API-14 | 制片中更换父 Take | 旧子链历史和新父关系都正确，可见影响范围 |
| API-15 | Render 完成但音轨损坏 | Render 技术 QC 失败，不能发布为合格成片 |

## 七、工程准备结论与下一步

采用**以自有 H3 为主的能力矩阵 + Typed Adapter + 持久 Worker + 真实媒体合同**。自有服务器关闭期间，以 Mock 和现有合规测试文件完成绝大部分功能；待开机时按其实际协议联调原生音画、完整图板与 Motion Context。RunningHub 只在必要时提供临时测试，不为其边缘接口投入主研发资源。外部文档不能替代自有真实路由验证。

本文件没有批准实际开发。下一份：[Codex 分期开发任务与验收清单](04-CODEX-BACKLOG-AND-ACCEPTANCE.md)。
