> **最新 UI/UX 基线（PD-011，2026-10-11）**：用户上传的七页面 HTML/CSS/JS 源码包优先于旧 `design/v1.4/` 文字稿。**新版 25 文件已经存于 [`design/approved-ui-2026/`](../design/approved-ui-2026/)，旧 `prototype/` 不是正式版本。**详见 [PD-011](decisions/2026-10-11-HTML-PROTOTYPE-UI-BASELINE.md)。

# 设计文档索引

状态更新：2026-10-10。

本仓库维护 **CineWeave Studio / AI Film Studio** 独立新项目的已确认基线、待审阅设计、待验证模型信息和未来可验收工程规范。

**现行正式基线是 V1.1。V1.2 和 V1.3 都是待审阅草案，不因已提交 GitHub 就自动获得批准。**

| 文档 | 状态 | 用途 |
|---|---|---|
| [V1.5 总体方案集中审定简报](MASTER-DESIGN-REVIEW-V1.5.md) | **总览草案，供一次性集中审阅** | 汇总已确认产品决策、六区、自有 H3 主路线、生成/成片、工程架构与待核验事项 |
| [架构基线 V1.1 摘要](architecture/PRODUCT-BASELINE-V1.1.md) | **已确认原则的整理摘要** | 固定六区、三层、LLM 与 Shot/Clip 主要边界；非原始文档逐字副本 |
| [模型服务配置](integrations/MODEL-SERVICES.md) | 用户指定配置；**接口待核验** | 聚合站 URL、默认模型及 H3 路由能力待核验事项 |
| [V1.2 详细业务蓝图索引](v1.2/README.md) | **草案，待审定** | 六区实际业务、三层协作、统一影视工程与案例 |
| [V1.2-01 六区业务流程](v1.2/01-BUSINESS-WORKFLOWS.md) | 草案 | 专业输入产物、跨区协作和质量反馈 |
| [V1.2-02 三层协作](v1.2/02-THREE-LAYER-COOPERATION.md) | 草案 | 贯穿六区的 LLM、系统事实和授权机制 |
| [V1.2-03 核心对象关系](v1.2/03-DOMAIN-OBJECTS.md) | 草案 | 唯一 Shot、多对多 Clip、Run/Take、真实续接、Timeline |
| [V1.2-04 端到端验收案例](v1.2/04-ACCEPTANCE-SCENARIOS.md) | 草案 | 80 秒短片及具体业务验收场景 |
| [V1.3 专业 AI 与生产引擎索引](v1.3/README.md) | **草案，待审定** | 专业创作、模型编译、真实生产和质量验证 |
| [V1.3-01 专业 LLM 六区协作](v1.3/01-CREATIVE-LLM-OPERATING-MODEL.md) | 草案 | 专业任务、上下文、候选/正式采纳、跨区诊断 |
| [V1.3-02 故事与剧本创作引擎](v1.3/02-STORY-SCREENPLAY-ENGINE.md) | 草案 | 剧情、人物、冲突、因果、对白、迭代与专业审查 |
| [V1.3-03 导演与 Shot/Clip 规划](v1.3/03-DIRECTING-SHOT-CLIP-PLANNING.md) | 草案 | 导演镜头决定、同 Shot 分镜落实、视听执行计划 |
| [V1.3-04 生成 DAG 与原生续接](v1.3/04-GENERATION-DAG-AND-CONTINUATION.md) | 草案 | 批量调度、合格父 Take、Motion Context、失败恢复 |
| [V1.3-05 模型编译与媒体 QA](v1.3/05-MODEL-COMPILERS-AND-QA.md) | 草案 | 模型能力检查、专属编译、真实音画审查与轻量成片 |
| [V1.3-06 关键决策与验收](v1.3/06-REVIEW-AND-ACCEPTANCE.md) | 草案 | 待确认事项、需实测的 H3 能力及工程验收条件 |
| [V1.3-07 人物 Look 四宫格生成规范](v1.3/07-CHARACTER-LOOK-GRID-SPEC-V1.md) | **新增 Look 规则与生成验收待审定** | 一 Look 一张正式整图；候选/历史、质量规则、跨区引用 |
| [V1.3-08 场景图生成规范](v1.3/08-SCENE-ASSET-IMAGE-SPEC-V1.md) | **上 1 下 3 布局已确认，技术细节草案** | 一张完整场景图板，主视角大、下方三辅助，空间连续性 |
| [V1.3-09 关键道具图生成规范](v1.3/09-KEY-PROP-ASSET-IMAGE-SPEC-V1.md) | **1+3 形式已确认，详细 QA 草案** | 一张关键道具整图、普通陈设归场景、状态/文字与真实生成验收 |
| [V1.3-10 角色声音与语速规范](v1.3/10-SOUND-VOICE-ASSET-SPEC-V1.md) | **声音方向已确认，详细规则待审定** | Voice Identity、基准语速、表演语速、停顿、样音、环境声与审片 QA |
| [V1.3-11 第 2 区资产生产与 QA](v1.3/11-ASSET-PRODUCTION-READINESS-AND-QA.md) | **集中审定草案** | 一次整理已确认资产、真实媒体就绪、图板/声音模型适配、回流与验收 |
| [V1.3-12 第 3→4 区导演到 Clip 交接](v1.3/12-DIRECTOR-SHOT-TO-CLIP-HANDOFF.md) | **集中审定草案** | 同一 Shot、视听动作/时间、完整资产引用、B1/B2 真续接和 H3 编译前检查 |
| [V1.3-13 H3 生成制作引擎](v1.3/13-H3-GENERATION-ENGINE-AND-RUN-LIFECYCLE.md) | **集中审定草案** | 两种 H3 编译器、图板/声音模式、异步 DAG、Run/Take 和真续接边界 |
| [V1.3-14 审片与成片规范](v1.3/14-REVIEW-TIMELINE-FINISHING-V1.md) | **集中审定草案** | Take 审片、音画连续性、时间码反馈、非破坏性轻剪辑、真实导出 |
| [H3 / GPT Image 2 路由文档核验](integrations/H3-ROUTE-CAPABILITY-AUDIT-2026-10-10.md) | **公开文档级已核对，项目接口未实测** | 自部署 MiniMax-H3 与 RunningHub 参数区别、素材上传和二次采样/真续接差异 |
| [V1.2/V1.3 关键设计决策简报](DESIGN-REVIEW-BRIEF-V1.2-V1.3.md) | **五项方向已批准；其他设计仍是草案** | 2026-10-10 正式确认 R-01～R-05 |
| [正式产品决策 PD-001～PD-005](decisions/2026-10-10-FIVE-PRODUCT-DIRECTIONS.md) | **已确认** | 深度剧本共创、全程专业 AI、授权尺度、多集基础、轻量成片 |
| [正式人物图片决策 PD-006](decisions/2026-10-10-CHARACTER-GRID-LOOK.md) | **已确认** | 所有正式人物、每个服装装造 Look 一张完整 2×2 四宫格、不拆四张单图 |
| [场景多视角宫格决策 PD-007](decisions/2026-10-10-SCENE-GRID-STANDARD.md) | **已确认** | 一张完整**上方大主图 + 下方三辅助视角**场景图板；像素/比例待实测 |
| [声音身份和语速决策 PD-008](decisions/2026-10-10-VOICE-ASSET-DIRECTION.md) | **已确认** | 角色声音身份和基准语速、导演台词语速、环境声音轻量管理 |
| [关键道具图板决策 PD-009](decisions/2026-10-10-HERO-PROP-BOARD.md) | **已确认** | 剧情关键道具一张完整 1+3 图板，普通环境道具归入场景 |
| [自有 H3 主力决策 PD-010](decisions/2026-10-11-H3-SELF-HOSTED-PRIORITY.md) | **已确认** | 自有 H3 长期生产主力、RunningHub 仅临时测试、服务器暂未开机 |
| [正式七页面 UI/UX 源码及素材](../design/approved-ui-2026/index.html) | **用户批准的唯一界面原型** | 首页 + 六区、导航交互、HTML/CSS/JS 和媒体资源；前端演示不代表真实生成 |
| [V1.5 首轮工程总体方案](v1.5/01-ENGINEERING-ARCHITECTURE-AND-ACCEPTANCE-PLAN.md) | **首轮技术方向草案，未启动代码** | 模块化单体、持久 Worker、媒体存储、真实影视竖向验收切片 |
| [V1.5-02 最小数据和事务合同](v1.5/02-DOMAIN-DATA-AND-TRANSACTION-CONTRACT.md) | **实施合同草案** | 唯一正式资产、Shot/Clip、媒体、Run/Take 与事务一致性 |
| [V1.5-03 API/Provider/Worker 合同](v1.5/03-API-PROVIDER-AND-JOBS-CONTRACT.md) | **实施合同草案** | 逻辑 API、H3 模式路由、预算、异步恢复和模型预检 |
| [V1.5-04 Codex 开发任务及验收](v1.5/04-CODEX-BACKLOG-AND-ACCEPTANCE.md) | **可用于开工的任务草案** | CW-00～CW-12、阶段依赖、Mock/真实媒体验收、付费授权分界 |

## 文档状态标准

- **已确认**：创作者明确确认的项目决定；如需改变，必须记录新决策与影响。
- **草案**：供创作者审阅的新设计，不自动升级为工程硬约束。
- **待核实**：需要准确模型资料、真实接口或可播放样片证据的事实。
- **被替代**：保留历史修订，不作为现行实施依据。

## 当前推进原则

1. **R-01～R-05 与 PD-006～PD-011 已获批准**。V1.2/V1.3/V1.5 其他细节仍为草案；实际界面实现以用户提交的七页面 HTML 原版为准。
2. 旧 V1.4 文字 UI 草案被新版 25 文件完整交互原型取代；后续不再单独设计另一套页面。
3. **V1.5-02～04 已写入工程候选合同**，但未获代码/部署许可。工程实施必须依据批准后的设计，不让 Codex 自行决定剧本、Shot、Clip、Take 等核心业务语义。
4. **按照创作者最新要求，暂不新建或更新关系视图/图纸。** 本轮只维护文字设计文件；原有文件中已存在的图例不代表又制作了新图。
5. 当前不创建应用前端、后端、数据库或收费 AI 生成任务；公开仓库不存放真实 API Key。
