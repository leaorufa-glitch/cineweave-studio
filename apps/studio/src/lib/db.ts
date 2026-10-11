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
`);
    } finally { connection.release(); }
  })().catch(e=>{ready=undefined;throw e;});
  return ready;
}
export async function transaction<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
 const client=await db().connect();try{await client.query("BEGIN");const value=await fn(client);await client.query("COMMIT");return value;}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
