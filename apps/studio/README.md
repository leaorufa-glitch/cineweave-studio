# CineWeave Studio — CW-00～02 开发版

新应用基于 Next.js / TypeScript、PostgreSQL，使用本地磁盘存储真实上传媒体。七页视觉原版位于根仓库 `design/approved-ui-2026/`，通过构建时拷贝到本项目 `public/approved/`；原始基准不被修改。额外 `bridge.js` 是局部真实业务交互面板，未连的旧演示按钮仍为原型展示（待逐步接入）。

## 本地运行

```bash
cd apps/studio
docker compose up -d
npm install
npm run sync:prototype
npm run dev
```

打开 http://localhost:3000 。数据库表在第一次 API 请求时按幂等 SQL 自动创建。PostgreSQL 数据存在 Compose volume，媒体存于 `apps/studio/.local-media/`，**两者均不提交 Git**。正式多用户部署之前须补鉴权、对象存储与显式迁移管理。

## 检查

```bash
npm run typecheck
npm run lint
npm run build
npm test
npm run smoke
```

`npm test` 默认执行离线原型与媒体测试；当设置 `CINEWEAVE_TEST_BASE_URL` 指向**连接隔离 PostgreSQL 数据库**的本地运行实例时，才会额外执行工程创建、剧本多版本与冲突、Mock 提案、真实资产上传与采用的 HTTP 集成测试。**当前尚未成功启动 PostgreSQL，因此数据库集成测试未通过验收（测试标记 skipped）**。`npm run smoke` 检查构建应用实际启动后首页、原型资源与业务桥接的 HTTP 返回。没有调用真实模型。RunningHub H3 后续可按授权临时测试，自有 H3 为生产主力。

注意：角色 Look 的 2:3 四宫格只进行尺寸初筛，四象内容人工确认；场景/道具的 1+3 同样人工验收（qa_status=needs_board_review），**不能把尺寸通过当成内容 QA 通过**。
