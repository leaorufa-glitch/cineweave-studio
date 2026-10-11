// Technical media only: FFmpeg color + sine sources, no model calls.
import pg from "pg";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export async function createReviewFixture() {
  const url = process.env.CINEWEAVE_TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith("_test")) throw Error("Review fixtures require an explicit isolated *_test database");
  const pool = new pg.Pool({ connectionString: url });
  await mkdir(resolve(".local-media"), { recursive: true });
  const directory = await mkdtemp(resolve(".local-media/review-fixture-"));
  const projectId = randomUUID(), filmId = randomUUID(), clipId = randomUUID(), shotId = randomUUID(), assetId = randomUUID();
  const mediaIds = [], takeIds = [];
  try {
    await pool.query("INSERT INTO projects(id,name,idea) VALUES($1,'审片技术验收工程','本地 FFmpeg 测试媒体，不代表生成质量')", [projectId]);
    await pool.query("INSERT INTO films(id,project_id,title) VALUES($1,$2,'审片技术验收')", [filmId, projectId]);
    await pool.query("INSERT INTO generation_clips(id,film_id,title,prompt,seconds) VALUES($1,$2,'同一 Clip 两个测试 Take','FFmpeg 技术夹具',4)", [clipId, filmId]);
    await pool.query("INSERT INTO director_shots(id,film_id,title,description) VALUES($1,$2,'钥匙交接 Shot','测试反馈定位')", [shotId, filmId]);
    await pool.query("INSERT INTO clip_shots(clip_id,shot_id,clip_start_seconds,clip_end_seconds) VALUES($1,$2,0,4)", [clipId, shotId]);
    await pool.query("INSERT INTO assets(id,film_id,kind,name,variant) VALUES($1,$2,'hero_prop','黄铜钥匙','默认')", [assetId, filmId]);
    for (const [index, color] of ["blue", "darkred"].entries()) {
      const file = join(directory, "take-" + index + ".mp4");
      await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `color=c=${color}:s=320x240:r=24`, "-f", "lavfi", "-i", `sine=frequency=${440 + index * 220}:sample_rate=48000`, "-t", "4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", file], { timeout: 30000 });
      const bytes = await readFile(file), media = randomUUID(), run = randomUUID(), take = randomUUID();
      mediaIds.push(media); takeIds.push(take);
      await pool.query("INSERT INTO media_files(id,filename,mime,bytes,sha256,storage_path) VALUES($1,$2,'video/mp4',$3,$4,$5)", [media, "ffmpeg-fixture-" + index + ".mp4", bytes.length, createHash("sha256").update(bytes).digest("hex"), file]);
      await pool.query("INSERT INTO video_runs(id,clip_id,provider,intent_key,status,input_snapshot) VALUES($1,$2,'local_fixture',$3,'completed',$4)", [run, clipId, "fixture-" + run, JSON.stringify({ source: "local FFmpeg color and sine", paidModel: false })]);
      await pool.query("INSERT INTO video_takes(id,run_id,media_id) VALUES($1,$2,$3)", [take, run, media]);
    }
    const context = { projectId, filmId, clipId, shotId, assetId, takeIds, mediaIds, directory };
    return { ...context, pool, async dispose() { await removeReviewFixture(context, pool); await pool.end(); } };
  } catch (error) {
    await pool.query("DELETE FROM projects WHERE id=$1", [projectId]);
    if (mediaIds.length) await pool.query("DELETE FROM media_files WHERE id=ANY($1::uuid[])", [mediaIds]);
    await rm(directory, { recursive: true, force: true }); await pool.end(); throw error;
  }
}
export async function removeReviewFixture(context, pool) {
  const outputs = (await pool.query("SELECT m.id,m.storage_path FROM renders r JOIN media_files m ON m.id=r.output_media_id WHERE r.film_id=$1", [context.filmId])).rows;
  await pool.query("DELETE FROM projects WHERE id=$1", [context.projectId]);
  await pool.query("DELETE FROM media_files WHERE id=ANY($1::uuid[])", [[...context.mediaIds, ...outputs.map(x => x.id)]]);
  for (const output of outputs) await rm(output.storage_path, { force: true });
  await rm(context.directory, { recursive: true, force: true });
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] || "")).href) {
  const action = process.argv[2], path = process.argv[3] || ".local-media/review-browser-context.json";
  if (action === "--create") {
    try { await readFile(path); throw Error("Fixture context already exists; clean it up first"); }
    catch (e) { if (e.code !== "ENOENT") throw e; }
    const { pool, ...context } = await createReviewFixture();
    delete context.dispose;
    await writeFile(path, JSON.stringify(context)); await pool.end();
    console.log("Local FFmpeg browser fixture created:", path);
  } else if (action === "--cleanup") {
    const url = process.env.CINEWEAVE_TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith("_test")) throw Error("Cleanup requires an explicit isolated *_test database");
    const pool = new pg.Pool({ connectionString: url });
    try { await removeReviewFixture(JSON.parse(await readFile(path, "utf8")), pool); await rm(path); }
    finally { await pool.end(); }
    console.log("Removed browser fixture:", path);
  } else throw Error("Use --create or --cleanup [context.json]");
}
