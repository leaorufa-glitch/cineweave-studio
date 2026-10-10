# V1.2｜详细业务架构设计

> 状态：草案（等待创作者逐项审阅）  
> 日期：2026-10-10  
> 基线：[V1.1 已确认架构](../architecture/PRODUCT-BASELINE-V1.1.md)

这一阶段把 V1.1 的产品共识展开为可落地的业务规则，而不是提前创建软件工程或数据库表。

## 设计交付

- [六大工作区业务与反馈流程](01-BUSINESS-WORKFLOWS.md)
- [用户／系统／AI 三层协作机制](02-THREE-LAYER-COOPERATION.md)
- [统一影视工程：核心对象与关系](03-DOMAIN-OBJECTS.md)
- [端到端业务验收案例](04-ACCEPTANCE-SCENARIOS.md)

## 现行决定（不得擅改）

- 六大工作区共同承担作品质量；故事、人物、情节、冲突与剧本创作是作品起点。
- 专业 LLM 贯穿六区、支持跨区诊断与创作；正式数据由系统版本和授权机制管理。
- 第 3 区导演创建 Shot，第 4 区细化同一 Shot；Shot 和 Generation Clip 不强制一对一。
- Clip、Run、Take、Timeline Segment 是不同对象；真实续接必须绑定选中的父 Run/Take 和可用 Motion Context。
- 生成模型通过既有聚合站接入；V1 的计划 Clip 上限为 15 秒。

## 审阅焦点

本阶段应重点判断：每一区的专业创作产出是否足够；跨区能否灵活返回；正式对象是否存在重复或断链；系统与 LLM 是否职责清晰；真实生成和审片能否形成闭环。

**注意**：本阶段对象模型是业务概念模型，尚未批准数据库表、前后端技术栈、固定 AI Agent 数量或 Prompt/API 格式。
