import {useState} from 'react';
export default function Login(){
 const [password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await r.json() as any;if(!r.ok)throw Error(data.error);location.assign('/admin')}catch(e:any){setError(e.message||'تعذر تسجيل الدخول')}finally{setBusy(false)}}
 return <main className="public-page"><form className="login-card" onSubmit={submit}><img src="/logo.jpeg" alt="NOVA MIND"/><h1>لوحة تحكم الشركة</h1><p>سجّل الدخول لإدارة الروابط وتصميم الـQR.</p><label className="block-field">كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'جاري الدخول…':'تسجيل الدخول'}</button><a href="/">عرض صفحة الشركة</a></form></main>
}
