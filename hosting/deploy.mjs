import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {profileSchema} from '../lib/profile-schema.mjs';
const wrangler=['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js'];
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});if(r.status!==0)throw Error('Deployment step failed')}
const profile=profileSchema.parse(JSON.parse((await readFile('data/profile.json','utf8')).replace(/^\uFEFF/,'')));
if(!profile.links.some(l=>l.enabled&&l.url))throw Error('Add and save at least one company link locally first.');
try{await readFile('.env.hosting.json','utf8')}catch(e){if(e.code!=='ENOENT')throw e;await writeFile('.env.hosting.json',JSON.stringify({ADMIN_PASSWORD:randomBytes(24).toString('base64url')},null,2),{flag:'wx',mode:0o600})}
run(['hosting/build.mjs']);
run([...wrangler,'d1','migrations','apply','DB','--remote','--config','wrangler.json']);
await mkdir('outputs',{recursive:true});
// Initial import only; later deployments never overwrite edits made online.
const sql="INSERT INTO profile(id,body) VALUES (1,'"+JSON.stringify(profile).replace(/'/g,"''")+"') ON CONFLICT(id) DO NOTHING;";
await writeFile('outputs/profile-seed.sql',sql,'utf8');
run([...wrangler,'d1','execute','DB','--remote','--config','wrangler.json','--file','outputs/profile-seed.sql']);
run([...wrangler,'deploy','--config','wrangler.json']);
run([...wrangler,'secret','bulk','.env.hosting.json','--config','wrangler.json']);
console.log('Deployment complete. Admin password is in .env.hosting.json (ignored by Git).');
