# CW-H3-PROMPT-RECOVERY-02｜阶段 A–C 施工与离线验收

状态：**代码与离线技术验收完成；四种有媒体输入的模式尚无已验证的 Provider 提交合同**。日期：2026-10-12。未调用付费生成、未部署网站、未更改批准的七页面视觉源码。

## 基线与保护

- `main` 从 `0c85e8b` 开始；阶段 A 提交 `22fa25b3a71bc58cb11c1cdc0242653c2fb0a3e4`，阶段 B 提交 `e1b2c9c0c259b98d4f6abc33019a8ce7df331f79`。旧 H3 worktree 未用于施工。
- 三份中断会话草稿原样保留在 `output/h3-recovery-20261012/`；备份 SHA256 分别为 `76b247053a4579dc04c0aa1d39f04d4988ce4472a51a380b89db05991b962c0a`、`36b53efeb75d5544f2b4bcca23ed7b4e9b2c3cda4590e9955e1cca66cd50ea0f`、`5265cda7ce94478693f86d80b8bd5f24ef18812a7a390a629d0e7c315fe455c3`（编译器、生产草稿、迁移草稿的顺序）。未复制覆盖旧草稿。
- 在正式库迁移前生成只读备份 `output/h3-recovery-20261012/cineweave-before-004-20261012.dump`，SHA256 `b27c534682f8fe311fb69981b700a6f2fdf0141fc5fb603b3ad6b68e14690fcc`。未触及 `.env.local`、stash、旧工作树、历史媒体和 Take/Render 数据。

## 实施链

1. 第四区的 Clip 版本保存模型无关的 `executionPlan`，包含 Director Shot ID、定时 Beat、动作因果、摄影、表演、声音、导演约束和正式参考用途。Shot 与 Beat 是不同身份；编译器只在真正跨 Shot 且有明确 transition 时增加 `[Shot N]`。
2. 第四区和第五区调用同一个 `compileH3`。T2VA/I2VA/FL2VA/L2VA 是官方三字段；Ref2VA 是六字段。引用从实际 Asset Revision、MediaFile SHA256 和用途生成；首尾帧优先于一般主体，其他图像按人物、场景、关键道具及稳定 ID 排序。上传顺序来自 Reference Map，不来自勾选顺序。
3. 第五区明确选择模式与 Provider，预览格式、来源、Reference Map、Provider 资格和完整 Prompt。确认冻结写入 `h3_compilations`，旧冻结记录不覆写。Run 创建重新编译并比较哈希，检查 Clip、剧本、Shot、正式媒资及规则版本，只允许已验证路线。Run 记录 `compiled_input_id` 和不可变输入快照；Worker 从快照上传并提交，不重新读取浮动 Prompt。
4. `004-h3-compiler.sql` 只新增编译记录、Run 外键及索引。正式库与隔离测试库均已应用；正式库迁移后有 11 Run（7 completed、4 submission_unknown）、7 Take、2 Render，旧 Run 的 `compiled_input_id` 全为 NULL，与迁移前盘点一致。已有未知提交未重发。

## 《再走一秒》六 Clip 离线对照

依据现存正式 Film `c54ee9bc-f71f-4966-ba51-e1b0087ed6cc`、六个 Clip 与 Director Shot、一个已采纳剧本版本、三张完整正式图板的 Revision/MediaFile/SHA256 建立只读快照。新 Execution Plan 是**对照候选**，没有写回旧 Clip。每段保留一个 Director Shot 和两个连续 Beat。旧提示词是自由文本引用说明；新 Prompt 使用 Ref2VA 六字段、三个 Picture/Subject 定义、保留关系、14 秒内部时序和分层声音。没有生成视频。

| Clip | 旧 Director Brief 的主要动作 | 编译对照新增的可核验信息 | 官方格式 | Provider 提交 |
| --- | --- | --- | --- | --- |
| 01 停摆 | 看停摆腕表 | 桌面空间、手部动作、静止秒针、无滴答和终态 | 通过 | 未验证 |
| 02 尝试 | 开表、拿镊子、调零件 | 左右手占用、一个连续动作、金属声与无成功滴答 | 通过 | 未验证 |
| 03 无声 | 贴耳听、失落、几乎合盖 | 无滴答的声音证据、工具放下与未合盖终态 | 通过 | 未验证 |
| 04 再试一次 | 停下合盖、再次调整 | 决定的动作因果、左右手和机械接触同步 | 通过 | 未验证 |
| 05 一秒 | 秒针开始走、切到人物反应 | 首次滴答与秒针同步；**旧 Shot 写明“一次切镜”，数据库只映射一个 Shot**，候选保持单 Shot 供诊断 | 仅格式通过；导演待确认 | 禁止使用此候选提交 |
| 06 带走 | 戴表、关灯、离开 | 左腕表、右手关灯、出画方向和空桌终态 | 通过 | 未验证 |

完整 Prompt 与 manifest 位于 `output/h3-recovery-20261012/six-clips-offline/`；运行 `cd apps/studio && node scripts/h3-six-clips-offline.mjs` 可复现。manifest 的 SHA256 为 `bc0dbdc3370730d8cb2870380d235903d514f3cceb60147fdc49ba6b7b4d221c`（最终代码提交前的生成记录；若规则变更须重算）。六段均是离线格式预览，`submitEligible=false`；第 05 段还需导演澄清切镜与 Shot 身份。

## 实测与边界

- 官方 `MiniMax-AI/MiniMax-H3` 的 Prompt Skill 固定为提交 `d21241f0a4b3acbb34c97dae47fa417b7065e438`；三份官方文件、各文件哈希、字段/标签/声音格式及要求和示例的区别见 [规范记录](../integrations/H3-PROMPT-SPEC.md)。中文增强指南原文件未取得；[差异对照](../integrations/H3-OFFICIAL-CINEWEAVE-DIFFERENCES.md)依据工单概述标明“部分对照”，不假称逐字阅读。
- 实际执行 `npm run typecheck`、`npm run lint`、`npm run build`，全部通过。隔离 `cineweave_test` 数据库与 32786 测试站上的 `npm test` 为 **26/26 通过、0 跳过**；包括五模式 Prompt、真实 API 预览/冻结/Run 快照、历史资产版本、引用上传顺序、幂等和 Worker 崩溃恢复。`python3 test/e2e_workspace.py`、`python3 test/e2e_h3.py` 与 `python3 test/e2e_finishing.py` 均通过 Chrome 浏览器检查，分别覆盖七区导航与保存、第四区计划编辑/只读预览和第五区冻结、真实本地媒体审片与非破坏性导出。隔离测试未配置付费模型密钥；Worker 回归仅使用 Mock Provider 和本地媒体。
- 当前 RunningHub 仅无参考 T2VA 有已核验提交资格；其余四种模式的 Prompt 可编译，Provider 的关键帧/Ref2VA 提交协议未实测。自有 H3 服务器和 Motion Context 尚未联调。尾帧参考、普通视频参考及二次采样均未被当作原生续接。
- 本次没有实际提交新的付费 Run，也没有对六段生成新 Take。已有七个 Take 与两个 Render 保持原状。技术测试不代表影片艺术质量审定。
- 旧 `scripts/phase1-demo.mjs --submit` 属第一阶段历史脚本，未实现新冻结合同；它的直接 Run 请求会被新 API 拒绝，不能用于后续正式生成。
