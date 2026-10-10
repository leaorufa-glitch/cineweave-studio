# V1.2-03｜统一影视工程：核心对象、版本与关系

> 状态：**业务领域模型草案，待审定**  
> 日期：2026-10-10  
> 注意：本文定义的是**可工程化的业务语义**，不是已经批准的 SQL 表结构、ORM 类、接口字段或数据库技术选择。

## 0. 核心原则

1. 一部影片的真实状态集中在统一影视工程中，六个工作区使用专业视图读写同一批对象。
2. **对象身份（Identity）与内容版本（Revision）分离**：对象在修改后仍能识别，既有版本及引用能追溯。
3. 编剧、导演和分镜的专业创作决定，与模型编译输入、真实 Run、媒体 Take、时间线片段必须分开保存。
4. **Director Shot 的唯一身份**由第 3 区建立；第 4 区只完善它的执行设计，不复制一套“Storyboard Shot”。
5. 故事顺序、生产任务依赖与成片剪辑顺序是三个不同概念，不能把某一个顺序当成所有对象的共同排序依据。
6. 后期修改不得静默抹掉已有真实媒体，系统必须能够识别下游需要重审之处。

## 1. 领域概念目录

| 概念对象 | 代表什么 | 与其他对象的关键关系 |
|---|---|---|
| **Project** | 创作和制作容器，可能包含独立 Film 或系列 | 拥有作品、资产与版本记录 |
| **Series**（可选） | 多集共享故事世界与人物的组织层次 | 可有多个 Episode/Film，共享有版本的 Canon/Assets |
| **Film / Episode** | 可成片交付的作品或剧集单集 | 关联剧本、Scene、Shot、Clip、Timeline、Render |
| **Story / Canon** | 故事事实、世界规则、人物关系和长期连续设定 | 被剧本、导演和资产工作引用 |
| **Screenplay Revision** | 某次可识别的正式剧本版本 | 关联 Scene/Beat 和具体改变 |
| **Scene** | 剧情场景单位，具有时空/情节语义 | 包含或关联 Beat，供导演 Shot 与 Clip 归属 |
| **Beat** | 人物行动、冲突、信息或情绪上的叙事节拍 | 可与多个 Shot 关联，Shot 亦可服务多个 Beat |
| **Character Definition** | 角色的戏剧身份、动机、关系、事实 | 与多场 Scene、视觉/声音资产、连续性状态相关 |
| **Direction Plan** | 全片或单场戏的导演表达方案 | 解释并约束相关 Shot 的创作意图 |
| **Director Shot** | 电影语言中的镜头身份及其导演决定 | 由第 3 区创建，第 4 区细化同一对象；服务 Beat |
| **Shot Execution Design** | 同一 Shot 的构图、运动、表演/音画时序、分镜画面等执行部分 | 从属于对应 Shot 与某个版本，不另建 Shot Identity |
| **Asset Identity** | 人物造型、场景、道具、人声等可复用资产身份 | 有多个 Asset Version，可供 Shot/Clip 按用途引用 |
| **Asset Version** | 某种资产的实际设计/已选用版本 | 关联真实 MediaFile 和参考职责 |
| **MediaFile** | 真实存在、可被访问及技术检查的图片/音频/视频文件 | 可由导入、资产生成、Run/Take 或 Render 产生 |
| **Generation Clip Plan** | 一次视频生成目标的模型无关视听执行计划 | 映射一个或多个 Shot、引用资产、指定依赖策略 |
| **Shot-Clip Mapping** | Shot 的哪个时间段落在 Clip 的哪个部分 | 支持**多对多**，带顺序、时间与跨段信息 |
| **Compiled Model Input** | 某 Clip Plan Revision 针对某模型/模式编译的不可变输入快照 | 记录 Prompt、参数、已验证引用、能力版本等 |
| **Generation Run** | 一次已提交的真实模型生成执行记录 | 绑定输入快照、模型路由、状态、远端任务信息 |
| **Take** | 可识别的真实生成结果候选及审看记录 | 关联 Run 与 MediaFile；被续接和时间线明确选用 |
| **Continuation Link** | 原生续接的真实父子依赖 | 指向父 Run/Take + Motion Context 与子生成任务 |
| **Continuity State** | 计划和观测到的人物/动作/服装/道具/空间/声音状态 | 附着在 Shot/Clip 边界或 Take 的实际起止状态 |
| **Timeline / Timeline Version** | 最终审片/剪辑方案的版本容器 | 有多个非破坏性 Segment，可渲染为影片 |
| **Timeline Segment** | 成片中实际使用的媒体范围和摆放位置 | 引用 Take 或导入 MediaFile 的特定入点/出点 |
| **Render / Delivery** | 实际成片编码文件及交付版本 | 对应 Timeline Version、参数与技术质量检查 |
| **Proposal / Decision / Finding** | AI 或用户的修改建议、正式采纳决定与质量发现 | 有出处、关联对象、版本和影响范围 |

以上是讨论范围与概念设计，具体哪些对象物理拆表、哪些合并文档存储，留到 V1.5 技术设计决定。

## 2. 关键关系图

~~~mermaid
flowchart TD
  P["Project / Series（可选）"] --> F["Film / Episode"]
  F --> SCR["Screenplay Revision"]
  SCR --> S["Scene / Beat"]
  F --> DIR["Direction Plan"]
  S --> SH["Director Shot\n唯一身份"]
  DIR --> SH
  SH --> EX["Shot Execution Design\n第4区完善"]
  A["Asset Identity → Asset Version → MediaFile"] -.按实际版本绑定.-> EX
  SH <-->|多对多：映射时间区间| CL["Generation Clip Plan"]
  EX --> CL
  A -.实际多模态参考.-> CL
  CL --> CI["Compiled Model Input"]
  CI --> R["Generation Run"]
  R --> T["Take / 实际视频"]
  T --> TS["Timeline Segment"]
  TS --> TL["Timeline Version → Render"]
  CONT["Continuation Link\n父Run/Take + Motion Context"] -.约束真实执行.-> R
~~~

*注：这张图只表达逻辑重点，不显示所有一对多或修订关系；独立生成的 Clip 没有 Continuation Link。*

## 3. Shot 和 Clip 的不可混淆关系

### 3.1 同一 Shot，从导演到分镜

- Shot ID = **稳定镜头身份**，包含“为什么这个镜头存在”的导演层描述和被允许的表达边界。
- 第 4 区补充的分镜、动作与音画时间等属于同一 Shot 的执行设计/版本；可修改但要尊重导演决定。
- 如第 4 区建议新增/拆分/合并镜头，形成提案；被导演层采纳后更新 Shot 图谱/身份关系，而不是悄然替换原镜头。

### 3.2 Shot ↔ Clip 的多对多映射

**场景 A：多个 Shot 在一个 Clip 中**

导演设计 Shot 01（双人中景）与 Shot 02（女儿近景）；第 4 区判断二者可由模型在 12 秒内生成，并将其映射到同一 Clip A。映射记录 Shot 01→Clip A 的计划区间 0–7s、Shot 02→Clip A 的计划区间 7–12s。其实际模型成功与否必须通过真实 Take 审看验证。

**场景 B：一个连续 Shot 跨多个 Clip**

导演要求 Shot 03 为 22 秒连续不切镜；第 4 区设计 Clip B1 12s 与 Clip B2 10s，并评估 B2 是否通过 H3 的原生 Motion Context 续接 B1。两 Clip 共享相同 Shot ID，映射注明其连续时间区间。**分 Clip 不代表电影语言中的切镜**。

**不可预设**：Shot = Clip，或者“只要两个 Clip 相邻就是可原生续接”。

### 3.3 映射记录至少应能表达的逻辑

- Shot ID、Shot Version、Clip Plan ID、Clip Plan Version
- Shot 内时间区间与 Clip 内预计时间区间
- 镜头在 Clip 内的相对顺序、进入/退出状态、是否为同一长镜头延续
- 来源导演决定及相关已选用资产版本
- 规划时间不是实际媒体时间；实际结果仍通过 Take 元数据和 Timeline Segment 表达

精确时间表示（帧基、毫秒或有理数时间）属于工程实现待定；需要避免浮点时间漂移。

## 4. 三种不同的“顺序”

| 顺序 | 回答的问题 | 示例 |
|---|---|---|
| **叙事/导演顺序** | 观众应该先看到哪个情节和 Shot？ | Scene A → Scene B，Shot 01 → Shot 02 |
| **生产依赖顺序** | 哪个真实生成任务必须等待哪个条件？ | Clip C2 续接必须等待 Clip C1 的指定合格 Take 与 Motion Context |
| **最终成片顺序** | 实际视频/音频素材如何摆放、剪切和组合？ | 时间线可用 Take 的中间 3 秒、插入反应镜头、调整声画位置 |

生产可以按资源条件并发执行独立 Clip，不用机械按照叙事顺序生成。

## 5. 版本、正式状态与数据权威

### 5.1 身份、版本、候选三分

- **对象身份**：即使修改，也能知道“这是同一个角色/Shot/Clip 计划”。
- **内容版本**：用于重建任何一次已批准方案和实际模型请求的输入快照。
- **候选/提案**：AI/用户尚未采纳的创作版本，与正式采用版本并存；不污染当前下游事实。

### 5.2 参考资产需要双重身份

- Asset Identity/Version 说明“这是谁/是什么，以及采用哪个形象/人声/道具版本”。
- MediaFile 说明“这张图/音频/视频实际存在哪里、能否使用、有什么技术属性”。
- Clip 引用必须指向真实可用媒体及其用途，不仅是一句“用角色图参考”。

### 5.3 修改影响传播

~~~mermaid
flowchart LR
   E["上游正式修改\n剧本/资产/导演/Shot"] --> Q["影响分析\n追踪版本与引用"]
   Q --> ST["相关Plan/Compiled Input 标记待复核"]
   Q --> WK["向用户/专业LLM呈现定点返工建议"]
   Q --> HIST["旧Run/Take/Timeline历史仍保留"]
~~~

- “需要复核”不等于自动删除或覆盖。
- 是否必须重生成由对艺术表达的影响、生成成本、用户决策和实际 Take 质量决定。
- 已经发布的影片版本保留溯源；新版本可以另行制作。

## 6. 原生续接：明确属于真实执行关系

Continuation Link 不是一个笼统的“从 Clip B 连接 Clip A”的箭头。它至少具备：

- 上游**实际 Generation Run 与被选用的 Take**；如真实接口只以任务 ID 标识上下文，应同时保留系统中的 Take 对应证据；
- 该上游运行时实际保存的 Motion Context 标识、存储状态、有效性及可用模型模式；
- 子 Clip Plan Revision 与子 Run 的真实续接输入；
- 父 Take 已按用户授权方式通过相应审看/放行条件；
- 是否待依赖、可执行、运行中、失败、失效/待复核、完成等执行状态；
- 父 Take 改选、父媒体质量不合格、上下文不可用或跨模型时的处理策略。

**高优先级不变量**：没有可用的真实 Motion Context 不得标记“原生续接已成功”。首尾帧引导、末帧重新生成、普通视觉参考与原生上下文续接是不同技术策略。

## 7. Clip Plan、Run、Take、Timeline 的关系

- **Clip Plan**：计划生成什么，可存在多个修订；遵守 V1 单次 ≤15s 规划限制。
- **Compiled Model Input**：某版本 Clip + 某目标模型/模式/参考文件形成的实际请求快照，不因后来修改而被覆盖。
- **Run**：每一次真实提交；记远端身份、提交/完成状态、重试关联、费用估计或实际值（以真实账单证据为准）。
- **Take**：Run 的真实媒体候选，可审看、比较、采用、拒用；同一个 Clip Plan 可有多次 Run/多个 Take。
- **Timeline Segment**：一个 Take 或 MediaFile 在影片中被使用的某区间；一个 Take 可以使用一部分，或者被多处引用。
- **Timeline Version**：本次成片的选择与实际顺序；Render 是导出的真实文件，不能凭时间线已经保存便声称成片已交付。

## 8. 连续性：计划与实际分开

| 连续性层次 | 来源 | 示例 |
|---|---|---|
| **Planned State** | 剧本、导演、资产、Shot/Clip 计划 | 女儿右手握钥匙；雨持续；父亲的声音低沉 |
| **Observed State** | 实际 Take 的审看和技术/多模态检查 | 生成后钥匙出现在左手；对白未同步；角色声音变化 |

系统必须保留二者差异，才能解释返工原因，而不是将“模型按要求做到了”作为默认事实。观察结果本身可能有误，应允许用户纠正。

## 9. 关键不变量与反例

| 规则 | 不允许的错误状态 |
|---|---|
| 同一 Shot 身份跨 3/4 区共享 | 两套 Shot ID 分别称为导演镜头和分镜镜头，失去来源关系 |
| Clip Plan 与 Run 分离 | 每次重试覆盖正式 Clip 规划 |
| Take 与 Timeline Segment 分离 | 剪掉 2 秒后误删原始 Take |
| 续接锚定真实父运行结果 | 父 Clip 序号存在就自动调用续接，即使父 Take 未生成 |
| 已编译请求绑定输入版本 | 修改角色参考后把旧 Run 伪称基于新参考 |
| 素材引用检查真实文件 | 数据中有图片提示文本，但提交模型时找不到对应媒体 |
| DAG 只约束真实依赖 | 因一条续接链失败而全局阻塞所有独立 Clip |
| 时间线选择与生成历史分离 | 改选 Take 就覆盖或删除不再选用的媒体 |
| 6 区持续评审与返工 | 剧本质量问题只能靠重新生成视频处理 |

## 10. 待审定的对象细节

- Project/Series/Film 的最小层级和多集共享方案。
- Scene、Beat、Shot 的最合适多对多粒度与稳定身份策略。
- 时间基准和精度：帧、毫秒、跨模型 FPS 差异。
- 生成 Run 是否泛化到图片/音频任务，或单独管理资产生成。
- 正式 Revision、Proposal、审核结果的具体状态图。
- Continuation Link 中具体网关字段、Motion Context 保存寿命与恢复规则。
- Continuity State 的自动检查与人工纠正机制。

**本文件是 V1.2 领域模型审阅草案，不构成数据库迁移或 API 合同。**