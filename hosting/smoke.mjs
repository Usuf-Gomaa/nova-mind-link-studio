import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.argv[2];if(!base||!base.startsWith('https://'))throw Error('Pass deployed HTTPS origin.');
const {ADMIN_PASSWORD}=JSON.parse(await readFile('.env.hosting.json','utf8'));
const request=(path,options={})=>fetch(base+path,{redirect:'manual',...options});
const profile=await request('/api/profile');assert.equal(profile.status,200);const data=await profile.json();assert.ok(data.links.some(l=>l.enabled&&l.url));
const admin=await request('/admin');assert.equal(admin.status,302);assert.equal(admin.headers.get('location'),base+'/login');
const blocked=await request('/api/profile',{method:'PUT',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(blocked.status,401);
const login=await request('/api/login',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({password:ADMIN_PASSWORD})});assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
assert.equal((await request('/admin',{headers:{cookie}})).status,200);
assert.equal((await request('/api/session',{headers:{cookie}})).status,200);
// Same-data save verifies the deployed database write without altering company content.
assert.equal((await request('/api/profile',{method:'PUT',headers:{cookie,origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)})).status,200);
assert.deepEqual(await (await request('/api/profile')).json(),data);
assert.equal((await request('/api/logout',{method:'POST',headers:{cookie,origin:base,'Content-Type':'application/json'},body:'{}'})).status,200);
console.log(JSON.stringify({publicPage:base,dashboard:base+'/admin',activeLinks:data.links.filter(l=>l.enabled&&l.url).length,login:'passed',anonymousWrite:'blocked',persistentSave:'passed'}));
