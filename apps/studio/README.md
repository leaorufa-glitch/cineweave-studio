# CineWeave Studio · 第一阶段可运行纵切版

## 当前可运行功能

本应用用 **Next.js 16 + TypeScript + PostgreSQL + 本地私有媒体目录 + 独立 Worker + FFmpeg** 实现专业 AI 影视创作的首轮真实闭环。**七页面视觉/交互基准仍在** [../../design/approved-ui-2026/](../../design/approved-ui-2026/)；构建时复制原版 HTML/CSS/JS/媒体到 public/approved（不修改原件），通过 `bridge.js` 和 `native-actions.js` 将真实业务操作注入原页面。

- **首页 / 剧本**：创建、重开真实影视工程；Scene/Beat 内容与不可变版本、乐观锁冲突、Mock AI 提案审阅/采纳/拒绝；DeepSeek 真实剧本提案与 AI 对话（只保存候选，绝不自动覆盖正式剧本）。
- **角色/场景/关键道具/声音**：图板/样音真实媒体文件上传，资产候选/正式采用和历史版本；GPT Image 2 输出 Base64 解码为持久 PNG，人物每 Look 一整张 2:3/2×2，场景及关键道具每状态一整张 1+3 图板；不拆图板为多个官方文件。图板视觉一致性仍需人工 QA。
- **导演 / 分镜**：共享 Director Shot；Generation Clip 4–15 秒，Clip↔Shot 多对多；原生续接的父 Clip/Context 预留，**RunningHub 路由不能伪装成真正的 Motion Context**。
- **生成制作**：RunningHub H3 真实参考媒体上传、Clip → Run、异步轮询、MP4 下载及保存、真实 Take，重复提交由 Run 的 Idempotency-Key 限制，状态清晰保留；Worker 独立于 Web 服务。
- **审片与成片**：同 Clip 的真实 Take 双播放器对比/试听；人工审片结论、版本与历史保存；按实际视频时长标记问题时间码，将原因关联到 Clip、关联 Shot 或本片资产，并返回对应工作区。问题处理记录持久保存，未解决问题不能通过审片，待返工 Take 不能采用、加入时间线或提交导出。人工采用真实 Take，加入轻量正式时间线，FFmpeg 合成真实有音轨 MP4；真实文件可下载。当前模板时间线、字幕调节、复杂混音和演示检查项仍是原型布局。

自有 H3 仍为未来正式生产路由；当前用 RunningHub 做真实测试。自有 Motion Context 原生续接须等自有服务器及真实协议可读后联调。

## Mac 本地启动（已有独立 PostgreSQL 时）

```bash
cd apps/studio
npm install
# 在 .env.local 内仅设置服务端 DARL_API_KEY 等；不要提交密钥
npm run dev
# 新终端，独立后台视频/成片 Worker
npm run worker
```

开发地址通常为 `http://localhost:3000`。如使用本次现成的 CineWeave 本地测试服务，则地址为 `http://127.0.0.1:32784`（该进程当前依赖 Mac 开机及本地数据库，不是云端部署）。

### PostgreSQL

使用 `apps/studio/compose.yaml` 的 `docker compose up -d` 可获得数据持久卷和绑定在 `127.0.0.1:5439` 的 PostgreSQL；首次镜像下载速度由 Docker Registry 决定。

本次在 Mac 上 Docker 镜像拉取迟滞，已改为 **Homebrew PostgreSQL 17**，数据目录 `apps/studio/.local-pg`（不进 Git），端口 5439。已初始化集群后可运行：

```bash
cd apps/studio
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D .local-pg \
  -l /tmp/cineweave-local-postgres.log \
  -o '-p 5439 -h 127.0.0.1' start
```

初次初始化需独立执行 `initdb -D .local-pg`、创建 `cineweave` 数据库/角色。本地测试库另用 `cineweave_test`，不共享真实创作数据。**示例测试口令及本地 trust 仅供本机开发，不能用于公网部署。**`DATABASE_URL` 可在本地服务启动进程上独立配置；默认开发值见 `.env.example`。数据库表当前通过幂等建表升级，正式生产前需独立 Schema 迁移机制。

### 服务端模型配置

复制 `.env.example` 为 `.env.local` 并填写服务器端 `DARL_API_KEY`。模型入口 `https://api.darl.cn`、文本 `deepseek-v4.1-flash`、图像 `gpt-image-2`、测试视频 `runninghub-minimax-h3`。**密钥仅存在服务端 `.env.local`（被 Git 忽略），绝不嵌入公开原型、浏览器 JS 或 Git 历史。**如果在外部可访问网络部署，必须先加用户鉴权、鉴权媒体下载、访问控制和生产级媒体存储。

## 验收命令

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run smoke
# App 连至隔离 PostgreSQL 测试库并运行时，执行完整 API 数据事务测试
CINEWEAVE_TEST_BASE_URL=http://127.0.0.1:32784 npm test
# 已安装 Python Playwright + Chrome 时，对真实七页 UI 执行浏览器回归
python3 test/e2e_ui.py
```

`test/e2e_render.py` 是可选的**真实媒体**验收，用 `CINEWEAVE_TEST_CONTEXT` 指向由本地允许的测试生成记录所构成的 JSON 才运行；不自动生成付费视频。FFprobe/Chrome 可进一步核查真实 MP4 视频、音轨、时间及可播放性。

### 审片功能验收（2026-10-11 续开发）

第 6 区点击 **“审片真实 Take”**，选择 Clip 与 Take，可选同 Clip 的对比 Take。播放器时间是 **Take 源视频时间**，不是最终影片时间码。保存时间码问题后，Take 标记为待返工；填写处理依据并解决所有问题，再提交人工结论。采用与审片状态分别保存，人工通过不自动采用，采用也不自动代表内容 QA 通过。既有采用记录在发现问题后保留，但禁止新导出；排队后标记待返工的 Take 也会被 Render Worker 拦截。

API：`GET /films/:id/takes`、`GET /takes/:id`、`GET/POST /takes/:id/issues`、`POST /takes/:id/review`、`POST /review-issues/:id/resolve`。修改审片需 `expectedTakeVersion`；处理问题需 `expectedVersion`，过期版本返回 409。反馈与结论保存至 `take_review_issues` / `take_review_decisions`，正式媒体 hash 不变。此次还修复了时间线查询遗漏 `media_id`、导致预览 URL 不正确的问题。

可同时运行独立测试服务，使用独立 Next 输出目录和隔离库。**测试服务不要启动收费视频 Worker**：

```bash
cd apps/studio
# 终端一；不会影响原有 32784 服务或真实创作库
CINEWEAVE_TEST_MODE=1 \
DATABASE_URL=postgres://cineweave:cineweave_dev@127.0.0.1:5439/cineweave_test \
DARL_API_KEY= npm run dev -- --hostname 127.0.0.1 --port 32785

# 终端二；仅使用 FFmpeg 色块/正弦音技术夹具，不调用模型
export CINEWEAVE_TEST_BASE_URL=http://127.0.0.1:32785
export CINEWEAVE_TEST_DATABASE_URL=postgres://cineweave:cineweave_dev@127.0.0.1:5439/cineweave_test
npm test
node test/review-fixture.mjs --create
CINEWEAVE_TEST_CONTEXT=.local-media/review-browser-context.json python3 test/e2e_review.py
node test/review-fixture.mjs --cleanup
```

本轮验证：隔离数据库 **7/7 自动测试通过**（没有跳过），类型检查、ESLint、正式构建通过；Chrome 原有操作回归及审片回归通过，Tabbit 核对了保存后重新打开、真实双 Take 播放、问题定位、人工通过/采用及画面。测试包含时长越界、错误对象、版本冲突、未解决问题阻断、提交导出后发现问题、缺失媒体、实际 FFmpeg 导出音轨及原 Take hash。**测试媒体不是影视生成样片，不代表艺术质量或自有 H3 联调通过。**

返工导航目前返回正确工作区并在工程面板显示正式对象 ID、来源 Take、时间码和原因；资产反馈会选中正式资产。Shot/Clip 的完整专业编辑器、自动内容 QA、整片时间码反馈、完整时间线编辑仍待继续开发。构建仍有现有媒体动态路径的 tracing 警告，当前交付仍限定本机开发，未公开部署。

2026-10-11 本地技术验收：**6/6 API/离线测试通过，TypeScript、ESLint、正式构建、Chrome 六区关键页面回归通过**。DeepSeek 真实提案、GPT Image 2 人物图板候选及两条 RunningHub H3（4 秒任务，实际各约 4.46 秒）已实测；两条 Take 经人工测试采用、时间线排列和 FFmpeg 输出约 **8.92 秒、1280×720、H.264/AAC** 的可播放 MP4。**图板无头服装要求尚未达到；真实拍摄质量仍需专业审片；这些测试仅为开发验收，不是最终影片质量保证。**

## 必须继续补齐的正式产品能力

- 部分原 HTML 操作仍为明确标记的演示，真实业务在原生按钮与可收起的工程数据面板中逐步接管；原型轻时间线布局与 DB 时间线尚未完全融合。
- 专业剧本深度共创、多集完整管理、资产图板视觉 QA、完整六区 AI 工作流需要继续深化，而不是把现有 Mock 聊天伪装为最终体验。
- 真正自有 H3 的 Motion Context 续接、可靠任务超时恢复策略、完整媒体声画质量/持续性自动审查、字幕/混音/灵活后期、80 秒高质量全片验收仍待实现。
- **目前是本机开发演示，不具备生产公网发布条件**：尚无账户鉴权、租户隔离、生产对象存储/后台部署、正式数据库迁移、安全审计、用户权限。不要将其直接部署上线。
