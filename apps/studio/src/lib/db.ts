import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | undefined;
let ready: Promise<void> | undefined;
export function db(): pg.Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://cineweave:cineweave_dev@localhost:5439/cineweave", max: 8 });
  return pool;
}
export async function ensureDb() {
  if (!ready) ready = (async () => {
    const connection = await db().connect();
    try {
      await connection.query(`
CREATE TABLE IF NOT EXISTS projects (
 id UUID PRIMARY KEY, name TEXT NOT NULL, idea TEXT NOT NULL DEFAULT '', version INT NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS films (
 id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, title TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS script_units (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('scene','beat')), parent_id UUID REFERENCES script_units(id), title TEXT NOT NULL, position INT NOT NULL, version INT NOT NULL DEFAULT 1, adopted_revision_id UUID
);
CREATE TABLE IF NOT EXISTS script_revisions (
 id UUID PRIMARY KEY, unit_id UUID NOT NULL REFERENCES script_units(id) ON DELETE CASCADE, revision_number INT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), source TEXT NOT NULL, UNIQUE(unit_id,revision_number)
);
CREATE TABLE IF NOT EXISTS ai_proposals (
 id UUID PRIMARY KEY, unit_id UUID NOT NULL REFERENCES script_units(id) ON DELETE CASCADE, base_version INT NOT NULL, suggestion TEXT NOT NULL, explanation TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','adopted','rejected')), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS media_files (
 id UUID PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL, bytes BIGINT NOT NULL, sha256 TEXT NOT NULL, storage_path TEXT NOT NULL, width INT, height INT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assets (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN ('character','location','hero_prop','voice')), name TEXT NOT NULL, variant TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', baseline_rate NUMERIC, version INT NOT NULL DEFAULT 0, adopted_revision_id UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(film_id,kind,name,variant)
);
CREATE TABLE IF NOT EXISTS asset_revisions (
 id UUID PRIMARY KEY, asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE, revision_number INT NOT NULL, media_id UUID REFERENCES media_files(id), description TEXT NOT NULL, qa_status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(asset_id,revision_number)
);
CREATE TABLE IF NOT EXISTS submission_intents (
 key TEXT PRIMARY KEY, response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE ai_proposals ADD COLUMN IF NOT EXISTS usage JSONB;
CREATE TABLE IF NOT EXISTS ai_history (
 id UUID PRIMARY KEY, film_id UUID REFERENCES films(id), unit_id UUID REFERENCES script_units(id),
 model TEXT NOT NULL, instruction TEXT NOT NULL, answer TEXT NOT NULL,
 usage JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS asset_candidates (
 id UUID PRIMARY KEY, asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
 media_id UUID NOT NULL REFERENCES media_files(id), provider TEXT NOT NULL,
 prompt TEXT NOT NULL, qa_status TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS director_shots (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
 scene_unit_id UUID REFERENCES script_units(id), title TEXT NOT NULL, description TEXT NOT NULL,
 sequence_number INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS generation_clips (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
 scene_unit_id UUID REFERENCES script_units(id), title TEXT NOT NULL,
 prompt TEXT NOT NULL, seconds INTEGER NOT NULL CHECK (seconds BETWEEN 4 AND 15),
 aspect_ratio TEXT NOT NULL DEFAULT '16:9',
 reference_media_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
 continuation_parent_clip_id UUID REFERENCES generation_clips(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS clip_shots (
 clip_id UUID NOT NULL REFERENCES generation_clips(id) ON DELETE CASCADE,
 shot_id UUID NOT NULL REFERENCES director_shots(id) ON DELETE CASCADE,
 clip_start_seconds NUMERIC NOT NULL, clip_end_seconds NUMERIC NOT NULL,
 PRIMARY KEY (clip_id,shot_id,clip_start_seconds)
);
CREATE TABLE IF NOT EXISTS video_runs (
 id UUID PRIMARY KEY, clip_id UUID NOT NULL REFERENCES generation_clips(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'runninghub',
 intent_key TEXT NOT NULL, provider_job_id TEXT,
 status TEXT NOT NULL DEFAULT 'waiting_submit',
 input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
 provider_snapshot JSONB,
 error TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(clip_id,intent_key)
);
CREATE TABLE IF NOT EXISTS video_takes (
 id UUID PRIMARY KEY, run_id UUID NOT NULL REFERENCES video_runs(id) ON DELETE CASCADE,
 media_id UUID NOT NULL REFERENCES media_files(id), qa_status TEXT NOT NULL DEFAULT 'needs_review',
 adopted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_take_per_run ON video_takes (run_id);
ALTER TABLE video_takes ADD COLUMN IF NOT EXISTS review_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS take_review_issues (
 id UUID PRIMARY KEY, take_id UUID NOT NULL REFERENCES video_takes(id) ON DELETE CASCADE,
 time_seconds NUMERIC NOT NULL CHECK(time_seconds >= 0),
 reason TEXT NOT NULL, target_kind TEXT NOT NULL CHECK(target_kind IN ('clip','shot','asset')),
 target_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
 resolution TEXT, version INTEGER NOT NULL DEFAULT 1,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_take_review_issues ON take_review_issues(take_id,created_at);
CREATE TABLE IF NOT EXISTS take_review_decisions (
 id UUID PRIMARY KEY, take_id UUID NOT NULL REFERENCES video_takes(id) ON DELETE CASCADE,
 review_version INTEGER NOT NULL, qa_status TEXT NOT NULL,
 note TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(take_id,review_version)
);
ALTER TABLE generation_clips ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE generation_clips ADD COLUMN IF NOT EXISTS adopted_take_id UUID REFERENCES video_takes(id);
CREATE TABLE IF NOT EXISTS timeline_segments (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
 clip_id UUID REFERENCES generation_clips(id), take_id UUID NOT NULL REFERENCES video_takes(id),
 position_index INTEGER NOT NULL,
 source_in_seconds NUMERIC NOT NULL DEFAULT 0,
 source_out_seconds NUMERIC,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renders (
 id UUID PRIMARY KEY, film_id UUID NOT NULL REFERENCES films(id) ON DELETE CASCADE,
 intent_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting_render',
 settings JSONB NOT NULL DEFAULT '{}'::jsonb,
 output_media_id UUID REFERENCES media_files(id),
 error TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(film_id,intent_key)
);
`);
    } finally { connection.release(); }
  })().catch(e=>{ready=undefined;throw e;});
  return ready;
}
export async function transaction<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
 const client=await db().connect();try{await client.query("BEGIN");const value=await fn(client);await client.query("COMMIT");return value;}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
