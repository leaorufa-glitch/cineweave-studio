import pg from "pg";
const { Pool } = pg;
let pool: pg.Pool | undefined;
let ready: Promise<void> | undefined;
export function db(): pg.Pool {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://cineweave:cineweave_dev@localhost:5439/cineweave", max: 8 });
  return pool;
}
export async function ensureDb() {
 if (!ready) ready = db().query("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").then(r=>{
  if(r.rows[0]?.version!=="003-lineage.sql")throw new Error("Database migrations required: npm run migrate");
 }).catch(e=>{ready=undefined;throw e;});
 return ready;
}
export async function transaction<T>(fn:(client:pg.PoolClient)=>Promise<T>):Promise<T>{
 const client=await db().connect();try{await client.query("BEGIN");const value=await fn(client);await client.query("COMMIT");return value;}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}
}
