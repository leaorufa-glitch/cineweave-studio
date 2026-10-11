# CW-PHASE1-FINISH-01 — implementation record

Status: in progress. Branch `feat/phase1-finish`, base `6283187` (retains the additional review implementation after the requested `4f0d404`). No production deployment authorized.

## Phase A

The seven-page compiled UI now loads `public/workspace.js`. Primary project, screenplay, asset, director, Clip, Run/Take and finishing actions operate on PostgreSQL. Layout and styles derive from the approved seven-page source. The original 25 design files are unchanged; bridge/native debug controllers are no longer loaded by the normal workflow.

Added additive checked SQL migrations, versioned workspace editing, candidate editing/adoption, shared Shot editing, complete asset boards, speech-rate separation, timeline trim/order/volume editing, and local Host/Origin access guards. Persistent active Film and page restore via browser storage; formal content is read from PostgreSQL.

Actually executed: `npm run typecheck`, `npm run lint`, `npm run build`, isolated PostgreSQL `npm test` (7/7, zero skips), `test/e2e_workspace.py` with Chrome (passed, zero browser errors, desktop/mobile, refresh/project switch/session restore). Before/after screenshots are private local artifacts under the original checkout's `output/phase1-finish-20261011/`. Build has the pre-existing dynamic local storage tracing warning, to address in phase B.

Pending phase B/C: worker leases/recovery, immutable submission snapshots, stronger media QA, additional failure tests, actual end-to-end sample, final cleanup and PR. These are not yet claimed complete.

## Phase B

Implemented explicit worker leases, 30-second heartbeat, expired-job recovery, 180-second remote poll spacing, submission markers before paid POST, and guarded `submission_unknown` handling. Reference-upload or preparation failures do not pretend to be remote submissions. Known remote IDs resume querying/download; unknown paid submissions require manual reconciliation and never automatically resubmit. Render jobs recover separately because local rendering is repeatable. Take persistence locks its Run and stores only one media/Take pair, with immutable source hashes, full FFmpeg decode, duration, dimensions, audio stream and audio-level measurements. Run/Render freeze production input snapshots. Local storage has a private adapter interface for future S3 implementations (S3 is not implemented).

Additional checked migration `003-lineage.sql` captures future AI/image input and provider metadata. Requests have JSON object/size validation, local access and cross-origin mutation guards; private media supports byte ranges. Provider error text is not exposed verbatim. Build filesystem tracing warning has been removed.

Actually executed: typecheck, lint and build; isolated tests now **10/10, no skips**, including concurrent claims, unknown submission protection, real worker process termination during an injected provider submission, a fresh recovery process, recoverable local rendering, duplicate delivery and independent speech rates. Deterministic worker providers never contact paid services.

Real sample is underway: DeepSeek and three GPT Image 2 boards are saved. Six 14-second RunningHub attempts were made once each: two returned remote IDs; four returned HTTP 502 without IDs and remain `submission_unknown`. No automatic extra paid submissions occurred. Known IDs continue polling at 180 seconds. Board content limitations are recorded as `needs_review` (not falsely accepted); dimension checks and content reviews are separate.
