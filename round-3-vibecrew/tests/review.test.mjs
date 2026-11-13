import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

test('PostgreSQL migrations and independent feature approval', async () => {
  const name = 'vibecrew-test-' + randomUUID();
  const docker = (args, input) => execFileSync('docker',args,{input, encoding:'utf8', timeout:60000});
  const sql = source => docker(['exec','-i',name,'psql','-q','-U','postgres','-v','ON_ERROR_STOP=1'],source);
  docker(['run','-d','--rm','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16-alpine']);
  try {
    for (let attempt=0; attempt<40; attempt++) {
      try { docker(['exec',name,'pg_isready','-U','postgres','-h','127.0.0.1']); break; }
      catch { await delay(250); }
    }
    sql("create role authenticated; create role anon; create role service_role; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;");
    const dir = new URL('../supabase/migrations/',import.meta.url);
    for (const file of (await readdir(dir)).sort()) sql(await readFile(new URL(file,dir),'utf8'));
    sql(await readFile(new URL('review.sql',import.meta.url),'utf8'));
  } finally { docker(['stop',name]); }
});
