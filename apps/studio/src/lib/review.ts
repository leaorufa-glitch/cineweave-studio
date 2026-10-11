import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db, ensureDb, transaction } from "./db.ts";
import { GatewayError } from "./providers.ts";

const exec = promisify(execFile);
const fail = (status: number, message: string): never => { throw new GatewayError(message, status); };
const uuid = (value: unknown): string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : fail(400, "Invalid ID");
const text = (value: unknown, name: string): string => typeof value === "string" && value.trim() && value.length <= 4000 ? value.trim() : fail(400, name + " required (maximum 4000 characters)");
const version = (value: unknown): number => Number.isInteger(value) && Number(value) >= 1 ? Number(value) : fail(400, "Expected integer review version");
const send = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
async function body(req: Request): Promise<Record<string, unknown>> {
  try { const value = await req.json(); if (!value || Array.isArray(value) || typeof value !== "object") return fail(400, "Invalid JSON object"); return value; }
  catch { return fail(400, "Invalid JSON object"); }
}

async function takeContext(takeId: string) {
  const result = await db().query(`SELECT t.*,r.clip_id,r.provider,c.film_id,c.title AS clip_title,m.filename,m.mime,m.storage_path
    FROM video_takes t JOIN video_runs r ON r.id=t.run_id JOIN generation_clips c ON c.id=r.clip_id
    JOIN media_files m ON m.id=t.media_id WHERE t.id=$1`, [takeId]);
  return result.rows[0] ?? fail(404, "Take not found");
}
async function duration(path: string): Promise<number> {
  try {
    const probe = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", path], { timeout: 15000, maxBuffer: 100000 });
    const data = JSON.parse(probe.stdout), seconds = Number(data.format?.duration);
    if (!data.streams?.some((s: { codec_type: string }) => s.codec_type === "video") || !Number.isFinite(seconds) || seconds <= 0) throw Error();
    return seconds;
  } catch { return fail(409, "Take video unavailable or unreadable; review requires real media"); }
}

export async function reviewDispatch(req: Request, parts: string[]): Promise<Response | null> {
  const filmTakes = parts[0] === "films" && parts.length === 3 && parts[2] === "takes";
  if (!filmTakes && !["takes", "review-issues"].includes(parts[0])) return null;
  await ensureDb();
  if (filmTakes && req.method === "GET") {
    return send((await db().query(`SELECT t.*,r.clip_id,r.provider,c.title AS clip_title,m.filename,m.mime,
      (SELECT count(*)::int FROM take_review_issues i WHERE i.take_id=t.id AND i.status='open') AS open_issues
      FROM video_takes t JOIN video_runs r ON r.id=t.run_id JOIN generation_clips c ON c.id=r.clip_id
      JOIN media_files m ON m.id=t.media_id WHERE c.film_id=$1 ORDER BY c.created_at,t.created_at DESC`, [uuid(parts[1])])).rows);
  }
  if (parts[0] === "takes" && parts.length === 2 && req.method === "GET") {
    const take = await takeContext(uuid(parts[1]));
    const seconds = await duration(take.storage_path);
    // Never return a private filesystem path to the browser.
    const { storage_path: _privatePath, ...visible } = take;
    void _privatePath;
    const shots = (await db().query("SELECT DISTINCT s.id,s.title FROM clip_shots l JOIN director_shots s ON s.id=l.shot_id WHERE l.clip_id=$1", [take.clip_id])).rows;
    const assets = (await db().query("SELECT id,name,kind,variant FROM assets WHERE film_id=$1 ORDER BY created_at", [take.film_id])).rows;
    const decisions = (await db().query("SELECT * FROM take_review_decisions WHERE take_id=$1 ORDER BY review_version", [take.id])).rows;
    return send({ ...visible, durationSeconds: seconds, mediaUrl: "/api/media/" + take.media_id + "/file", shots, assets, decisions });
  }
  if (parts[0] === "takes" && parts.length === 3 && parts[2] === "issues") {
    const take = await takeContext(uuid(parts[1]));
    if (req.method === "GET") return send((await db().query("SELECT * FROM take_review_issues WHERE take_id=$1 ORDER BY time_seconds,created_at", [take.id])).rows);
    if (req.method === "POST") {
      const b = await body(req), expected = version(b.expectedTakeVersion), reason = text(b.reason, "Reason");
      const time = b.timeSeconds, kind = b.targetKind, target = uuid(b.targetId);
      if (typeof time !== "number" || !Number.isFinite(time) || time < 0 || time > await duration(take.storage_path)) fail(400, "Timecode exceeds actual Take duration");
      if (!["clip", "shot", "asset", "take"].includes(String(kind))) fail(400, "Invalid feedback target");
      return send(await transaction(async c => {
        const locked = (await c.query("SELECT review_version FROM video_takes WHERE id=$1 FOR UPDATE", [take.id])).rows[0];
        if (locked.review_version !== expected) fail(409, "Take review changed; reload before saving");
        let valid = kind === "clip" && target === take.clip_id || kind === "take" && target === take.id;
        if (kind === "shot") valid = Boolean((await c.query("SELECT 1 FROM clip_shots WHERE clip_id=$1 AND shot_id=$2", [take.clip_id, target])).rowCount);
        if (kind === "asset") valid = Boolean((await c.query("SELECT 1 FROM assets WHERE film_id=$1 AND id=$2", [take.film_id, target])).rowCount);
        if (!valid) fail(400, "Feedback target must be this Clip, its Shot, or an asset in this Film");
        const issueId = randomUUID();
        const issue = (await c.query("INSERT INTO take_review_issues(id,take_id,time_seconds,reason,target_kind,target_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *", [issueId, take.id, time, reason, kind, target])).rows[0];
        await c.query("UPDATE video_takes SET qa_status='needs_changes',review_version=review_version+1 WHERE id=$1", [take.id]);
        await c.query("INSERT INTO take_review_decisions(id,take_id,review_version,qa_status,note) VALUES($1,$2,$3,'needs_changes',$4)", [randomUUID(), take.id, expected + 1, reason]);
        return { ...issue, takeReviewVersion: expected + 1 };
      }), 201);
    }
  }
  if (parts[0] === "takes" && parts.length === 3 && parts[2] === "review" && req.method === "POST") {
    const take = await takeContext(uuid(parts[1])), b = await body(req), expected = version(b.expectedTakeVersion);
    const status = b.qaStatus, note = text(b.note, "Review note");
    if (!["needs_review", "needs_changes", "accepted"].includes(String(status))) fail(400, "Invalid review status");
    await duration(take.storage_path);
    return send(await transaction(async c => {
      const locked = (await c.query("SELECT review_version FROM video_takes WHERE id=$1 FOR UPDATE", [take.id])).rows[0];
      if (locked.review_version !== expected) fail(409, "Take review changed; reload before saving");
      if (status !== "needs_changes" && (await c.query("SELECT 1 FROM take_review_issues WHERE take_id=$1 AND status='open' LIMIT 1", [take.id])).rowCount) fail(409, "Resolve open issues before accepting or resetting the Take review");
      await c.query("UPDATE video_takes SET qa_status=$2,review_version=review_version+1 WHERE id=$1", [take.id, status]);
      await c.query("INSERT INTO take_review_decisions(id,take_id,review_version,qa_status,note) VALUES($1,$2,$3,$4,$5)", [randomUUID(), take.id, expected + 1, status, note]);
      return { takeId: take.id, qaStatus: status, reviewVersion: expected + 1 };
    }));
  }
  if (parts[0] === "review-issues" && parts.length === 3 && parts[2] === "resolve" && req.method === "POST") {
    const issueId = uuid(parts[1]), b = await body(req), expected = version(b.expectedVersion), resolution = text(b.resolution, "Resolution");
    return send(await transaction(async c => {
      const issue = (await c.query("SELECT take_id FROM take_review_issues WHERE id=$1", [issueId])).rows[0];
      if (!issue) fail(404, "Review issue not found");
      // Serialize issue changes and QA decisions on the same Take.
      await c.query("SELECT id FROM video_takes WHERE id=$1 FOR UPDATE", [issue.take_id]);
      const changed = await c.query("UPDATE take_review_issues SET status='resolved',resolution=$2,resolved_at=now(),version=version+1 WHERE id=$1 AND version=$3 AND status='open' RETURNING *", [issueId, resolution, expected]);
      if (!changed.rowCount) fail(409, "Issue already resolved or changed; reload");
      const take = (await c.query("UPDATE video_takes SET review_version=review_version+1 WHERE id=$1 RETURNING review_version,qa_status", [issue.take_id])).rows[0];
      await c.query("INSERT INTO take_review_decisions(id,take_id,review_version,qa_status,note) VALUES($1,$2,$3,$4,$5)", [randomUUID(), issue.take_id, take.review_version, take.qa_status, "Resolved issue " + issueId + ": " + resolution]);
      return { ...changed.rows[0], takeReviewVersion: take.review_version };
    }));
  }
  return null;
}
