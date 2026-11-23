import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--mode','hosted'],{stdio:'inherit'});process.exit(r.status||0);
