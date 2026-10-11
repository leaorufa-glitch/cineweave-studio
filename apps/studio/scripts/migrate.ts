import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {db} from '../src/lib/db.ts';
const c=await db().connect();
try {
 await c.query('SELECT pg_advisory_lock(713805121)');
 await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
 for(const version of (await readdir(resolve('migrations'))).filter(x=>x.endsWith('.sql')).sort()){
  const sql=await readFile(resolve('migrations',version),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const previous=(await c.query('SELECT sha256 FROM schema_migrations WHERE version=$1',[version])).rows[0];
  if(previous){if(previous.sha256!==hash)throw new Error('Applied migration checksum changed: '+version);continue;}
  await c.query('BEGIN');
  try{await c.query(sql);await c.query('INSERT INTO schema_migrations(version,sha256) VALUES($1,$2)',[version,hash]);await c.query('COMMIT');console.log('Applied',version);}
  catch(e){await c.query('ROLLBACK');throw e;}
 }
}finally{await c.query('SELECT pg_advisory_unlock(713805121)');c.release();await db().end();}
