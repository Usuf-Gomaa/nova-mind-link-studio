import {profileSchema} from '../lib/profile-schema.mjs';
const encoder=new TextEncoder();
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
async function digest(value){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)))}
async function key(password){return crypto.subtle.importKey('raw',encoder.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
export async function sessionCookie(password){
 const payload=`${Math.floor(Date.now()/1000)+43200}.${crypto.randomUUID()}`;
 const signature=hex(await crypto.subtle.sign('HMAC',await key(password),encoder.encode(payload)));
 return `nova_session=${payload}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`;
}
export async function authorized(request,env){
 if(!env.ADMIN_PASSWORD)return false;
 const token=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nova_session='))?.slice(13);
 if(!token)return false;const parts=token.split('.');if(parts.length!==3||!/^\d+$/.test(parts[0])||Number(parts[0])<Date.now()/1000||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 const sig=Uint8Array.from(parts[2].match(/../g),b=>parseInt(b,16));
 return crypto.subtle.verify('HMAC',await key(env.ADMIN_PASSWORD),sig,encoder.encode(parts[0]+'.'+parts[1]));
}
async function readJson(request,max=2000000){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('invalid');
 let total=0;const chunks=[];const reader=request.body?.getReader();if(!reader)throw new Error('invalid');
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new Error('large')}chunks.push(value)}
 const all=new Uint8Array(total);let pos=0;for(const b of chunks){all.set(b,pos);pos+=b.byteLength}return JSON.parse(new TextDecoder().decode(all));
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
   if(path==='/admin/'||path.startsWith('/admin/'))return Response.redirect(url.origin+'/admin',302);
   if(path==='/admin'){
    if(!await authorized(request,env))return Response.redirect(url.origin+'/login',302);
    const response=await env.ASSETS.fetch(new Request(url.origin+'/',request));
    const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','same-origin');return new Response(response.body,{status:response.status,headers});
   }
   if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
   if(!env.DB)return json({error:'قاعدة البيانات غير مجهزة'},503);
   if(['POST','PUT','DELETE'].includes(request.method)&&request.headers.get('origin')!==url.origin)return json({error:'الطلب غير مسموح'},403);
   if(path==='/api/connection'&&request.method==='GET')return json({publicOrigin:url.origin,hosted:true,canEdit:await authorized(request,env)});
   if(path==='/api/session'&&request.method==='GET')return json({authenticated:await authorized(request,env)});
   if(path==='/api/login'&&request.method==='POST'){
    if(!env.ADMIN_PASSWORD)return json({error:'الدخول غير مجهز'},503);
    const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
    const now=Math.floor(Date.now()/1000),windowStart=Math.floor(now/900)*900;
    const row=await env.DB.prepare('INSERT INTO auth_attempts(ip_hash,attempts,window_start) VALUES (?,1,?) ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END, window_start=excluded.window_start RETURNING attempts').bind(ip,windowStart).first();
    if(row.attempts>10)return json({error:'محاولات كتير. حاول بعد 15 دقيقة.'},429,{'Retry-After':'900'});
    const data=await readJson(request,4096);if(typeof data.password!=='string')return json({error:'كلمة المرور غير صحيحة'},401);
    const candidate=await digest(data.password),expected=await digest(env.ADMIN_PASSWORD);let mismatch=0;for(let i=0;i<64;i++)mismatch|=candidate.charCodeAt(i)^expected.charCodeAt(i);
    if(mismatch)return json({error:'كلمة المرور غير صحيحة'},401);
    await env.DB.prepare('DELETE FROM auth_attempts WHERE ip_hash = ?').bind(ip).run();
    return json({ok:true},200,{'Set-Cookie':await sessionCookie(env.ADMIN_PASSWORD)});
   }
   if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':'nova_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
   if(path==='/api/profile'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT body FROM profile WHERE id=1').first();return json(row?JSON.parse(row.body):null);
   }
   if(path==='/api/profile'&&request.method==='PUT'){
    if(!await authorized(request,env))return json({error:'انتهت الجلسة. سجّل الدخول من /login'},401);
    const parsed=profileSchema.safeParse(await readJson(request));if(!parsed.success)return json({error:'راجع الروابط وبيانات الشركة'},400);
    await env.DB.prepare('INSERT INTO profile(id,body) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').bind(JSON.stringify(parsed.data)).run();return json({ok:true});
   }
   return json({error:'غير موجود'},404);
  }catch(e){if(e.message==='large')return json({error:'حجم البيانات كبير'},413);if(e instanceof SyntaxError||e.message==='invalid')return json({error:'بيانات غير صالحة'},400);console.error('API error',e.message);return json({error:'تعذر تنفيذ الطلب'},500)}
 }
};

