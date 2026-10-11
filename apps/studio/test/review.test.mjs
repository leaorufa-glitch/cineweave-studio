import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createReviewFixture } from "./review-fixture.mjs";
const origin = process.env.CINEWEAVE_TEST_BASE_URL;
const enabled = Boolean(origin && process.env.CINEWEAVE_TEST_DATABASE_URL);
const exec = promisify(execFile);
async function api(path, method = "GET", body, headers = {}) {
  const res = await fetch(origin + "/api" + path, { method, headers: { "Content-Type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
test("real Take review: timecode, ownership, conflicts, resolution, QA, adoption and render gates", { skip: !enabled && "Requires isolated test server and CINEWEAVE_TEST_DATABASE_URL" }, async () => {
  await api("/projects"); // Initialize application schema in the same test database.
  const fixture = await createReviewFixture();
  const { filmId, shotId, assetId, takeIds, pool } = fixture;
  const take = takeIds[0];
  try {
    const list = await api("/films/" + filmId + "/takes");
    assert.equal(list.status, 200); assert.equal(list.data.length, 2);
    assert.equal(list.data[0].qa_status, "needs_review");
    const detail = await api("/takes/" + take);
    assert.equal(detail.status, 200); assert.ok(detail.data.durationSeconds >= 4);
    assert.equal(detail.data.storage_path, undefined); assert.equal(detail.data.shots[0].id, shotId);
    const base = { expectedTakeVersion: 1, timeSeconds: 1.25, reason: "钥匙变形", targetKind: "asset", targetId: assetId };
    assert.equal((await api("/takes/" + take + "/issues", "POST", { ...base, timeSeconds: 100 })).status, 400);
    assert.equal((await api("/takes/" + take + "/issues", "POST", { ...base, timeSeconds: null })).status, 400);
    assert.equal((await api("/takes/" + take + "/issues", "POST", { ...base, targetId: randomUUID() })).status, 400);
    const otherShot = randomUUID();
    await pool.query("INSERT INTO director_shots(id,film_id,title,description) VALUES($1,$2,'未关联 Shot','')", [otherShot, filmId]);
    assert.equal((await api("/takes/" + take + "/issues", "POST", { ...base, targetKind: "shot", targetId: otherShot })).status, 400);
    assert.equal((await api("/takes/" + take + "/issues", "POST", { ...base, targetKind: "clip", targetId: randomUUID() })).status, 400);
    const created = await api("/takes/" + take + "/issues", "POST", base);
    assert.equal(created.status, 201); assert.equal(created.data.takeReviewVersion, 2);
    const issues = await api("/takes/" + take + "/issues");
    assert.equal(issues.data[0].reason, "钥匙变形"); assert.equal(Number(issues.data[0].time_seconds), 1.25);
    assert.equal((await api("/takes/" + take + "/issues", "POST", base)).status, 409);
    for (const qaStatus of ["accepted", "needs_review"]) {
      assert.equal((await api("/takes/" + take + "/review", "POST", { expectedTakeVersion: 2, qaStatus, note: "不能绕过未解决问题" })).status, 409);
    }
    assert.equal((await api("/takes/" + take + "/adopt", "POST", { expectedClipVersion: 1 })).status, 409);
    const resolve = await api("/review-issues/" + created.data.id + "/resolve", "POST", { expectedVersion: 1, resolution: "核对道具与源视频后，确认可以采用" });
    assert.equal(resolve.status, 200); assert.equal(resolve.data.takeReviewVersion, 3);
    assert.equal((await api("/review-issues/" + created.data.id + "/resolve", "POST", { expectedVersion: 1, resolution: "重复处理" })).status, 409);
    assert.equal((await api("/takes/" + take + "/review", "POST", { expectedTakeVersion: 2, qaStatus: "accepted", note: "过期结论" })).status, 409);
    // Only one concurrent decision may commit on a review version.
    const concurrent = await Promise.all(["通过 A", "通过 B"].map(note => api("/takes/" + take + "/review", "POST", { expectedTakeVersion: 3, qaStatus: "accepted", note })));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    const current = await api("/takes/" + take);
    assert.equal(current.data.qa_status, "accepted"); assert.equal(current.data.decisions.length, 3);
    const adopted = await api("/takes/" + take + "/adopt", "POST", { expectedClipVersion: 1 });
    assert.equal(adopted.status, 200);
    assert.equal((await api("/films/" + filmId + "/timeline", "POST", { takeId: take, positionIndex: 0 })).status, 201);
    assert.equal((await api("/films/" + filmId + "/timeline")).data[0].media_id, fixture.mediaIds[0]);
    const renderKey = "review-render-" + randomUUID();
    const queued = await api("/films/" + filmId + "/renders", "POST", {}, { "Idempotency-Key": renderKey });
    assert.equal(queued.status, 201);
    const newIssue = await api("/takes/" + take + "/issues", "POST", { ...base, expectedTakeVersion: 4, targetKind: "shot", targetId: shotId, reason: "已采用后发现站位问题" });
    assert.equal(newIssue.status, 201);
    assert.equal((await api("/films/" + filmId + "/timeline", "POST", { takeId: take, positionIndex: 1 })).status, 409);
    assert.equal((await api("/films/" + filmId + "/renders", "POST", {}, { "Idempotency-Key": "blocked-" + randomUUID() })).status, 409);
    // Execute only this Render in-process; never run the paid video Worker.
    const runRender = async () => exec(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", "const {renderOneIfWaiting}=await import('./src/lib/render-worker.ts');const {db}=await import('./src/lib/db.ts');await renderOneIfWaiting();await db().end();"], { env: { ...process.env, DATABASE_URL: process.env.CINEWEAVE_TEST_DATABASE_URL, MEDIA_ROOT: fixture.directory, DARL_API_KEY: "" }, timeout: 60000 });
    await runRender();
    const rejectedRender = await api("/renders/" + queued.data.id);
    assert.equal(rejectedRender.data.status, "failed"); assert.match(rejectedRender.data.error, /marked for changes/);
    await api("/review-issues/" + newIssue.data.id + "/resolve", "POST", { expectedVersion: 1, resolution: "重新审看确认站位可用" });
    const accepted = await api("/takes/" + take + "/review", "POST", { expectedTakeVersion: 6, qaStatus: "accepted", note: "人工核对音画和站位后通过" });
    assert.equal(accepted.status, 200);
    const sourcePath = (await pool.query("SELECT storage_path FROM media_files WHERE id=$1", [fixture.mediaIds[0]])).rows[0].storage_path;
    const hashBefore = createHash("sha256").update(await readFile(sourcePath)).digest("hex");
    const readyRender = await api("/films/" + filmId + "/renders", "POST", {}, { "Idempotency-Key": "accepted-" + randomUUID() });
    assert.equal(readyRender.status, 201); await runRender();
    const complete = await api("/renders/" + readyRender.data.id);
    assert.equal(complete.data.status, "completed");
    assert.equal(createHash("sha256").update(await readFile(sourcePath)).digest("hex"), hashBefore);
    const outputPath = (await pool.query("SELECT storage_path FROM media_files WHERE id=$1", [complete.data.output_media_id])).rows[0].storage_path;
    const metadata = JSON.parse((await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", outputPath])).stdout);
    assert.ok(metadata.streams.some(s => s.codec_type === "audio")); assert.ok(Number(metadata.format.duration) >= 4);
    assert.equal((await fetch(origin + complete.data.outputUrl)).status, 200);
    // Missing media cannot be accepted or annotated as if it had been reviewed.
    await pool.query("UPDATE media_files SET storage_path=$2 WHERE id=$1", [fixture.mediaIds[1], sourcePath + ".missing"]);
    assert.equal((await api("/takes/" + takeIds[1])).status, 409);
    assert.equal((await api("/takes/" + takeIds[1] + "/review", "POST", { expectedTakeVersion: 1, qaStatus: "accepted", note: "无媒体不得通过" })).status, 409);
  } finally { await fixture.dispose(); }
});
