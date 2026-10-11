# MiniMax H3 Prompt 编译规则｜已核实版本

状态：**官方格式已核实；Provider 的模式执行能力按路由分别核实**。核验日期：2026-10-12。

## 来源与版本

官方仓库 `MiniMax-AI/MiniMax-H3` 的 `main` 在核验时指向提交 `d21241f0a4b3acbb34c97dae47fa417b7065e438`。已实际读取该提交中的：

| 官方文件 | SHA256 |
| --- | --- |
| [skills/h3-prompt-writing/SKILL.md](https://github.com/MiniMax-AI/MiniMax-H3/blob/d21241f0a4b3acbb34c97dae47fa417b7065e438/skills/h3-prompt-writing/SKILL.md) | `a7000443588ca3f145e3b3fd8900f14e0325dc460bd811268fac89a9dc8e56d0` |
| [references/base-en.txt](https://github.com/MiniMax-AI/MiniMax-H3/blob/d21241f0a4b3acbb34c97dae47fa417b7065e438/skills/h3-prompt-writing/references/base-en.txt) | `2cfebc096a6e08370f288d468d90b60f7f9bcb938f94bf090816e910e48e75fc` |
| [references/ref-en.txt](https://github.com/MiniMax-AI/MiniMax-H3/blob/d21241f0a4b3acbb34c97dae47fa417b7065e438/skills/h3-prompt-writing/references/ref-en.txt) | `1e574f356716ad55612247ffb7bbccbcdb484ad96599d63c7dca1af186b1fab7` |

这三份是 **Prompt 写作规范**，不是 Darl RunningHub 或创作者自有 H3 的 API 合同。`H3_RULES.version` 在代码中固定，日常编译不访问官网。官方没有在这三份文件中给出单独的模型权重版本号；此处只固定 H3 Prompt Skill 的 Git 版本。

## 官方格式要求与实施规则

| 模式 | 必需结构 | 关键帧首行 |
| --- | --- | --- |
| T2VA | `integrated_multimodal_description` → `overall_soundscape` → `non_diegetic_music` | 无 |
| I2VA | 同上 | `<Picture 1>` 在 0.00 秒为 `[Shot 1]` 的完整首帧 |
| FL2VA | 同上 | Picture 1 对齐 0.00 秒；Picture 2 对齐实际末 Shot 的 `S.SS` 秒 |
| L2VA | 同上 | `<Picture 1>` 对齐实际末 Shot 的 `S.SS` 秒 |
| Ref2VA | `subject_definitions` → `summary` → `retention_analysis` → `detailed_description` → `overall_soundscape` → `non_diegetic_music` | 根据真实引用角色写入正文，不套用基础模式首行 |

- 描述段使用英语；对白、歌词和画面实际可见文字保留原语言。对白写为 `(Sx)` 与 `<d>[Language] 原文</d>`。旁白使用官方 `says in an off-screen voiceover` 并说明画面人物嘴唇闭合。跨切镜和截断语言使用 `<scenetrans>`、`<cutoff>`。
- 首 Shot 写 `[Shot 1]`，不在标签后加起始时间。后来实际切镜写 `[Shot N] At MM:SS.mmm, ...`，时间严格递增；同一 Director Shot 内的连续 Beat 不能由编译器擅自切镜。
- Ref2VA 的官方标签只有 `<Subject N>`、`<Picture N>`、`<Video N>`、`<Audio N>`。Subject 是可复用的可见内容，不等于媒体文件；一个完整图板可定义多个 Subject，但媒体本身仍保持单张。`<Environment>` 和 `<Prop 1>` 不是官方独立标签。
- `summary` 以真实任务类型开头：`keyframe completion`、`reference generation`、`video editing`、`video continuation`、`audio reuse`、`audio reference`，可用 ` + ` 组合。`retention_analysis` 可见内容使用 `fully_preserved`、`partially_preserved`、`attribute_transfer`、`weak_reference`；音频使用 `fully_copy`、`partially_copy`、`reference`、`weak_reference`。
- `overall_soundscape` 总结环境、物理动作和非语言人声；对白和歌词留在时间线正文。仅明确要求全程静音时使用 `N/A`。`non_diegetic_music` 只写角色听不到的配乐，无配乐时写 `N/A`。

## 官方要求与示例建议

字段名、顺序、关键帧对齐首行、标签语义、时间码、语言及对白标记是编译格式约束。官方示例中的烘焙店、雨中骑车、某种乐器或镜头运动是**示例**，不能当成每个 Clip 必须包含的内容。Ref2VA 指南所说一般 350–500 英文单词是生成场景的详细度建议；对白密集和编辑任务按实际内容调整，不机械补词。

## CineWeave 的分层与路由边界

第 4 区保存模型无关的 Audiovisual Execution Plan：Beat 的时间、同一 Director Shot、动作因果、表演、摄影、声音、对白、连续性、正式 Asset Revision 及用途。第 4 区可调用**同一编译核心**预览。第 5 区选择模型模式与实际 Provider，做正式校验、审阅、冻结及 Run 提交。正式图板不拆成多个正式资产。Run 必须保留所用编译版本、引用映射和输入快照。

官方 Prompt Skill 不证明 RunningHub 支持特定关键帧或 Ref2VA 语义。当前 RunningHub 的一般视频提交与素材传输曾技术测试，自有 H3 协议尚未联调；I2VA、FL2VA、L2VA、Ref2VA 和原生 Motion Context 续接在相应路由完成实测前只允许离线预览。尾帧、普通视频参考和二采不能冒充原生续接。
