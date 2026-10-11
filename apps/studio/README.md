# CineWeave Studio — local first-phase application

**2026-10-11 implementation status:** seven primary workspaces operate on PostgreSQL. Approved design source remains `../../design/approved-ui-2026/`. Build copies its visual resources, compiles shared helpers and loads `public/workspace.js`; demo data and simulated actions are excluded. No engineering/debug panel is required.

## Run locally

Requires Node 22+, PostgreSQL 17+, FFmpeg and FFprobe. This workstation's PostgreSQL runs at `127.0.0.1:5439`; real database `cineweave`, isolated database `cineweave_test`. Set `DATABASE_URL` for another instance.

```bash
cd apps/studio
npm ci
cp .env.example .env.local
# Fill private server configuration, never commit or print its key.
npm run local
# http://127.0.0.1:32787/approved/index.html
# Ctrl-C shuts down web + Worker. PostgreSQL is an independent service.
```

`local` applies checked additive migrations, syncs approved resources and supervises loopback-bound web and Worker. Choose another port with `PORT`. Run one supervisor per checkout. Separate terminals can run `npm run dev -- --hostname 127.0.0.1 --port 32787` and `npm run worker`. Avoid older Workers against the same database.

`npm run migrate` uses sorted SQL, advisory locking, transactions and checksums. Never edit applied migrations. API requests check readiness without creating tables. Back up PostgreSQL and private media together before moving machines.

## Primary workflows

| Page | Implemented operations |
| --- | --- |
| Home | Real Film create/open, persisted last Film/page, unified project switch, synopsis and production status |
| Story | Scene/Beat editing, immutable versions, compare/restore; real DeepSeek editable candidates, adopt/reject and conflict guards |
| Art | Character Look, location state, hero prop, VoiceIdentity; create/edit, real GPT Image 2/uploaded candidates, full-board preview/adoption/history, independent baseline rate |
| Director | Shared versioned Shot: intent, performance, action, camera, sound; dialogue performance rate and independent pause |
| Planning | 4–15s Clip, multiple Shot intervals, same Shot editing, current/historical formal asset references; blocked native continuation planning |
| Generation | Idempotent real Run, query/download/status, multiple Take players, frozen input/source snapshots, unknown-submission reconciliation, download-only retry |
| Review | Take playback, timecode problems linked to Shot/Clip/Asset/Take, resolution/history/source navigation, adoption, ordering/trim/volume/fades and real FFmpeg MP4 download |

AI discussions persist with current Film/workspace text context; they are suggestions, not visual/audio observations. Board dimension and content QA are separate; formal boards remain whole. VoiceIdentity baseline is independent of director rate/pause. New RunningHub submissions use 0.4MP as an approximate 480P target; actual dimensions are measured, not promised. The route does not expose a steps parameter, so the 20-step preference is preserved without inventing an upstream field. The earlier live sample was generated at 0.2MP.

## Reliability and private media

Video jobs have five-minute leases, 30-second heartbeats and 180-second remote polls. Durable markers precede paid POSTs. Unknown HTTP 5xx/network results or submission crashes become `submission_unknown`, never automatically another paid submission. Bind an existing remote ID after checking the gateway. Known IDs resume query/download; completed-media retrieval failures retry download only. Run locking and uniqueness prevent duplicate Take/media references.

Readiness checks actual duration/dimensions/streams, complete FFmpeg decoding, SHA256 and audio mean/peak levels. They do not certify acting, identity, dialogue semantics or continuity. Render freezes timeline/source hashes, rejects newly flagged Takes and recovers repeatable local rendering. Pending content QA is visibly separate from successful technical export.

Storage is private local (`MEDIA_ROOT` or `.local-media`). `PrivateMediaStore` defines immutable put/read/remove for future S3; **S3 is not implemented**. Private paths/keys are not returned, media supports byte ranges, and build tracing no longer includes the whole project.

## Deterministic tests

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke
# Separate terminal: isolated database and no model key.
CINEWEAVE_TEST_MODE=1 \
DATABASE_URL=postgres://cineweave:cineweave_dev@127.0.0.1:5439/cineweave_test \
DARL_API_KEY= npm run dev -- --hostname 127.0.0.1 --port 32786
# Test terminal:
export CINEWEAVE_TEST_BASE_URL=http://127.0.0.1:32786
export CINEWEAVE_TEST_DATABASE_URL=postgres://cineweave:cineweave_dev@127.0.0.1:5439/cineweave_test
npm test
python3 test/e2e_workspace.py
python3 test/e2e_finishing.py
```

Test-mode supervisor starts web only. Fixture scripts require explicit `*_test` database. Provider fixtures never call paid services. Tests cover version conflicts, complete boards, independent rates, many-to-many Shot/Clip, 15s limits, owned-H3 blocking, frozen lineage, concurrent leases, actual process termination during injected submission, recovery, duplicate delivery, technical media QA and rendering. Chrome covers all seven pages, saving/reload/project switch/session restore/mobile and real trim/fade/MP4/audio download. Technical fixtures do not represent film quality.

## Actual media acceptance and remaining limits

本轮 CW-P1-ACCEPTANCE-02 在同一 Film《再走一秒》完成六段真实 RunningHub H3 Take、审片记录、采用、时间线和 FFmpeg 输出。最终样片为 `83.361333s, 1280×720, 24fps, H.264/AAC`，交付记录见 `docs/execution/CW-P1-ACCEPTANCE-02.md`，本地媒体位于 `output/cw-p1-acceptance-20261011/`（不提交 Git）。

四个原始 Run 的状态仍是 `submission_unknown`。网关任务历史没有匹配任务；请求日志显示 HTTP 502 的 RunningHub 提交响应解析失败、quota=0，但没有原始上游响应或远程 ID，不能据此证明从未接受。执行中曾错误地按缺失历史各补提一次；补 Run 与原 Run 分开保留，已停止继续重发，原 Run 的最终保护值为 `safeToRegenerate=false`。样片是可审阅技术交付，人物/场景/道具连续性和声音内容仍待创作者艺术审片。

生产页面已验证最终媒体可播放、可定位 0/40/80 秒；自动化测试和技术媒体检查不代表艺术质量通过。自有 H3 与原生 Motion Context 仍待真实联调；本轮仅使用公开 RunningHub 路由字段。
