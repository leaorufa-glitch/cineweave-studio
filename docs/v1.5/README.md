# V1.5｜工程实施包（设计阶段）

> **状态：首轮工程方案已形成草案；尚未批准技术栈、尚未编写或部署业务代码；2026-10-10。**

当前按照创作者的要求，先完整收敛产品/专业 AI/生成/审片/技术方案，再决定是否启动 Codex 工程实施。不能把已经提交 GitHub 的文档等同于已运行系统。

## 集中审阅入口

**[总体方案集中审定简报](../MASTER-DESIGN-REVIEW-V1.5.md)**：先看这一份即可了解已批准与待批准项目，不必逐文件重新确认小细节。

## 当前文档

| 文件 | 状态 | 作用 |
|---|---|---|
| [01｜工程总体架构与验收路线](01-ENGINEERING-ARCHITECTURE-AND-ACCEPTANCE-PLAN.md) | **建议方案草案** | 模块化 Web + 持久 Worker、媒资存储、六区真实闭环 |
| [02｜领域数据、版本与事务合同](02-DOMAIN-DATA-AND-TRANSACTION-CONTRACT.md) | **工程实施合同草案** | Shot/Clip 多对多、图板唯一正式版本、媒体/Run/Take 溯源、父续接与并发约束 |
| [03｜API、H3 适配器与任务合同](03-API-PROVIDER-AND-JOBS-CONTRACT.md) | **工程实施合同草案** | API、两条 H3 路由编译、权限、任务恢复、媒体技术检查、费用与阻断状态 |
| [04｜Codex 开发清单与验收](04-CODEX-BACKLOG-AND-ACCEPTANCE.md) | **等待正式开工授权** | CW-00～CW-12 有依赖的开发任务、Mock 与收费测试边界、自动化验收 |
| [H3 与 GPT Image 2 公开路由核验](../integrations/H3-ROUTE-CAPABILITY-AUDIT-2026-10-10.md) | **公开文档级核对，无当前项目实测** | 自部署 H3、RunningHub H3 请求合同差异、图板/声音/任务/API 验证 |
| [V1.3-13｜生成引擎](../v1.3/13-H3-GENERATION-ENGINE-AND-RUN-LIFECYCLE.md) | **专项草案** | Typed 编译、队列与 DAG、父 Take Context、媒体与成本状态 |
| [V1.3-14｜审片与成片](../v1.3/14-REVIEW-TIMELINE-FINISHING-V1.md) | **专项草案** | 实媒体审片、非破坏时间线、声音和 Render 技术 QC |

## 批量审定的主要关注点

工程准备首先要确认**真实生产闭环优先、少组件但不牺牲媒体版本与任务可靠性**，而不是单独审批每一个按钮/字段。

**已形成首轮实施合同草案**：领域数据与事务、逻辑 API、H3 Provider/Worker、CW-00～CW-12 分期验收。**仍需**获准实际编码与选定部署环境；真实 Motion Context 续接接口资料、具体模型账号级能力与付费测试预算未获得。未授权前不创建应用运行实例，也不调用收费生成。

V1.5 的状态不得从“文档草案”误写为“应用已具备功能”。
