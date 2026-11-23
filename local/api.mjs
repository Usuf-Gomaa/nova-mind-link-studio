import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {resolve} from 'node:path';
import {profileSchema as schema} from '../lib/profile-schema.mjs';
const loopback=ip=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);
export function localApi(){
 let queue=Promise.resolve();
 const file=resolve(process.env.NOVA_DATA_DIR||'data','profile.json');
 const middleware=async(req,res,next)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(!['/api/profile','/api/connection'].includes(pathname))return next();
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  if(pathname==='/api/connection'){
   const addresses=Object.values(networkInterfaces()).flat().filter(a=>a&&a.family==='IPv4'&&!a.internal).map(a=>a.address);
   const preferred=addresses.find(a=>a.startsWith('192.168.'))||addresses.find(a=>a.startsWith('10.'))||addresses[0];
   return send(200,{publicOrigin:preferred?`http://${preferred}:${req.socket.localPort}`:null,canEdit:loopback(req.socket.remoteAddress)});
  }
  try{
   if(req.method==='GET'){try{return send(200,JSON.parse(await readFile(file,'utf8')))}catch(e){if(e.code==='ENOENT')return send(200,null);throw e}}
   if(req.method!=='PUT')return send(405,{error:'الطريقة غير مسموحة'});
   // Visitors on Wi-Fi can read the profile; only the local computer can edit it.
   if(!loopback(req.socket.remoteAddress))return send(403,{error:'افتح لوحة التحكم على جهاز الشركة باستخدام localhost للتعديل'});
   const origin=req.headers.origin;
   if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)return send(403,{error:'مصدر الطلب غير مسموح'});
   if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'البيانات غير صالحة'});
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2000000)return send(413,{error:'حجم البيانات كبير'});}
   let data;try{data=JSON.parse(raw)}catch{return send(400,{error:'JSON غير صالح'})}
   const parsed=schema.safeParse(data);if(!parsed.success)return send(400,{error:'راجع الاسم والروابط واللون'});
   const save=queue.then(async()=>{await mkdir(resolve(process.env.NOVA_DATA_DIR||'data'),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(parsed.data,null,2),'utf8');await rename(file+'.tmp',file)});
   queue=save.catch(()=>{});await save;return send(200,{ok:true});
  }catch(e){console.error('Local data error:',e.message);if(!res.headersSent)send(500,{error:'تعذر قراءة أو حفظ البيانات المحلية'});}
 };
 return {name:'nova-local-api',configureServer(server){server.middlewares.use(middleware)},configurePreviewServer(server){server.middlewares.use(middleware)}};
}


