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

Historical development verified real DeepSeek/GPT Image 2, two ~4.46s H3 Takes and ~8.92s MP4. This sprint created **《再走一秒》**: real DeepSeek proposal, three GPT Image 2 complete boards and six 14s RunningHub attempts. **Two succeeded; four HTTP 502 responses lacked IDs and remain unknown, attempted once each without resubmission.** Actual source Takes are 608×352, ~14.375s each. First Take's late gaze toward camera was recorded at 12s and excluded by trimming to 11.5s. The timeline exported **25.889333s, 1280×720, 24fps, H.264/AAC**, preserving originals. This is a **partial, pending-quality technical sample**; 720p normalization does not recover source detail or prove native 480P.

Private delivery in original checkout: `output/phase1-finish-20261011/再走一秒-待审技术样例.mp4`, before/after screenshots, full boards, original Takes/contact sheets and QA. None are committed. `scripts/phase1-demo.mjs` needs explicit `CINEWEAVE_LIVE_DEMO=1`, is not an automated test and must not be rerun blindly. Its resume context is private `.local-media/phase1-demo.json`.

The planned ~80s full film is **not completed**: four unknown submissions need gateway reconciliation before further attempts. Board details, identity/continuity and audio content need creator art review. Owned H3 protocol/Motion Context await actual integration. Full automatic artistic QA, subtitle editor, multi-track mixing, complete multi-episode management and cross-project reuse remain later work.

Creator-approved access policy (2026-10-11): all pages and business APIs are open to all visitors, without login, allowlists or role checks. Tunnel Host/Origin headers are accepted; GET/POST responses and OPTIONS preflight allow cross-origin browser access. Model keys remain private server configuration. Input/media validation, version conflicts, QA and idempotency continue to protect data integrity and prevent duplicate paid submissions.

For the existing Cloudflare share, keep `npm run local` and its tunnel to `http://127.0.0.1:32787` running. Use the tunnel origin with `/approved/index.html`; project and media URLs are relative to that origin. This is the creator-authorized local share, not a new production deployment. No main merge or owned-H3 capability is claimed.
