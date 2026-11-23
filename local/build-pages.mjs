import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
// A static snapshot can be hosted on GitHub Pages without a backend.
try{const text=await readFile('data/profile.json','utf8');JSON.parse(text);await copyFile('data/profile.json','public/profile.json')}catch(e){console.error('احفظ بيانات الشركة محليًا أولًا، ثم أعد تشغيل npm run build:pages');process.exit(1)}
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','pages'],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
await writeFile('dist/.nojekyll','');
console.log('GitHub Pages snapshot is ready in dist/. No upload or publication was performed.');
