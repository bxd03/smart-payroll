import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['tests/netlify.test.ts'],bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@netlify/database':'./tests/netlify-db-mock.ts'},outfile:'.sites-runtime/tests/netlify.mjs'});
const r=spawnSync(process.execPath,['--test','.sites-runtime/tests/netlify.mjs'],{stdio:'inherit'});process.exit(r.status??1);
