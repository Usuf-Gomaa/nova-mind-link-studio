import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {localApi} from './api.mjs';
test('local data persists; remote writes, cross-origin writes and unsafe links are rejected',async()=>{
 const root=process.cwd();await mkdir('outputs',{recursive:true});const temp=await mkdtemp(resolve('outputs/local-api-test-'));process.chdir(temp);
 try{
  let handler;localApi().configureServer({middlewares:{use(fn){handler=fn}}});
  async function call(method,data,{ip='127.0.0.1',origin='http://localhost:5173'}={}){
   const req={url:'/api/profile',method,headers:{host:'localhost:5173',origin,'content-type':'application/json'},socket:{remoteAddress:ip,localPort:5173},async *[Symbol.asyncIterator](){if(data!==undefined)yield JSON.stringify(data)}};
   let status,body;const res={headersSent:false,writeHead(s){status=s;this.headersSent=true},end(value){body=JSON.parse(value)}};
   await handler(req,res,()=>assert.fail('API route was not handled'));return {status,body};
  }
  assert.deepEqual(await call('GET'),{status:200,body:null});
  const config={name:'Local test',description:'',logo:'./logo.jpeg',color:'#233b83',style:'rounded',links:[{id:'one',type:'website',label:'Website',url:'https://example.com',enabled:true}]};
  assert.equal((await call('PUT',config)).status,200);
  assert.deepEqual(JSON.parse(await readFile('data/profile.json','utf8')),config);
  assert.deepEqual((await call('GET')).body,config);
  const withUnusedLink={...config,links:[...config.links,{id:'unused',type:'instagram',label:'Instagram',url:'',enabled:true}]};
  assert.equal((await call('PUT',withUnusedLink)).status,200,'Unused default link must not block saving the real link');
  assert.deepEqual((await call('GET')).body,withUnusedLink);
  assert.equal((await call('PUT',config)).status,200);
  assert.equal((await call('PUT',config,{ip:'192.168.1.50'})).status,403);
  assert.equal((await call('PUT',config,{origin:'https://untrusted.example'})).status,403);
  assert.equal((await call('PUT',{...config,links:[{...config.links[0],url:'javascript:alert(1)'}]})).status,400);
  assert.deepEqual((await call('GET')).body,config);
 }finally{process.chdir(root)}
});
