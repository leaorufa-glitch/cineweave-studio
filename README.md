# CineWeave Studio

AI Film Studio：面向个人创作者的专业 AI 影视创作与制作系统。

## 当前阶段

产品总体架构 V1.1 已在项目讨论中确认；当前进入详细设计阶段。
本仓库先保存设计基线、业务规范和验收资料，尚未开始应用代码开发。

## 已确认的原则

- 六大工作区：前期创作、资产设计、导演创作、分镜与生成规划、生成制作、审片与成片。
- 六区共同决定作品质量；故事与剧本是创作原点，专业 LLM 贯穿全部六区。
- 六区共享统一影视工程，系统管理正式数据、版本、上下文、依赖与可靠执行。
- 第 3 区决定 Shot 的创作意图与镜头语言，第 4 区完善同一个 Shot 并规划 Generation Clip。
- Shot 与 Clip 分开管理：支持多镜头合并生成，以及长镜头分段续接。
- 第 5 区执行生成并产生 Take，第 6 区审片、组织成片并向前反馈质量问题。
- H3 为第一版主力，规划采用单次最长 15 秒；原生续接必须绑定真实的上游生成结果，并核实具体服务路由的能力。
- 项目独立，不沿用旧项目、旧仓库或旧 Skill 的设计结论。

## 文档导航

- [项目工作规则](AGENTS.md)
- [设计文档索引](docs/README.md)
- [已确认架构基线摘要](docs/architecture/PRODUCT-BASELINE-V1.1.md)
- [模型服务配置与待核实事项](docs/integrations/MODEL-SERVICES.md)
- [交互与视觉设计范围](design/README.md)
- [验收资料范围](tests/README.md)

## 当前设计进度

- **V1.1：已确认的产品架构基线**（仓库保存整理摘要）。
- **V1.2：六区业务、三层协作、统一影视对象、80 秒短片验收**——已形成**待审定草案**。
- **V1.3：专业 LLM 贯穿六区、剧本引擎、导演 Shot/分镜、H3 生产调度与续接、真实媒体 QA**——已形成**待审定草案**。
- **五项产品方向已于 2026-10-10 正式确认**：[查看决策记录](docs/decisions/2026-10-10-FIVE-PRODUCT-DIRECTIONS.md)。
- **资产专项决定已确认**：[PD-006 人物每 Look 一张四宫格](docs/decisions/2026-10-10-CHARACTER-GRID-LOOK.md)、[PD-007 场景 1+3 分层宫格](docs/decisions/2026-10-10-SCENE-GRID-STANDARD.md)、[PD-008 角色声音与基准/表演语速](docs/decisions/2026-10-10-VOICE-ASSET-DIRECTION.md)、[PD-009 关键道具 1+3 整板](docs/decisions/2026-10-10-HERO-PROP-BOARD.md)。详细生图/声音/模型适配规则仍在审阅。
- **V1.4：六区 UI/UX 第一轮文字交互草案**——[已提交，待审定](design/v1.4/README.md)，尚无效果图或可点击原型。
- **模型接口核验**——已按 [Darl 公开文档](docs/integrations/H3-ROUTE-CAPABILITY-AUDIT-2026-10-10.md)核对两种 H3 路由和 GPT Image 2 的字段；**没有调用真实 API，未证明当前账号支持或模型实际效果**。
- **V1.3 生成制作与成片**——[生成引擎草案](docs/v1.3/13-H3-GENERATION-ENGINE-AND-RUN-LIFECYCLE.md)和[审片成片草案](docs/v1.3/14-REVIEW-TIMELINE-FINISHING-V1.md)已经集中形成。
- **V1.5：Codex 工程实施包**——[第一轮架构与验收路线草案](docs/v1.5/README.md)已形成；技术方向待审定，**未开始代码开发**。

项目最新要求：**暂不制作或更新关系视图**。V1.2/V1.3/V1.5 未经确认的详细设计不作为已批准实现要求；已明确批准的 **PD-001～PD-009 决策除外**。
技术栈、数据库表结构、Agent 架构尚未确定；未经确认的设计必须标为草案。

本仓库按创作者决定保持公开。模型凭据不属于产品设计文档，本次初始化未写入凭据。
