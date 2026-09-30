import {getInquiryDb} from '@/db/inquiries';
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Please submit using the form on this site.'},{status:403});
  if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Unsupported submission.'},{status:415});
  const text=await request.text();if(text.length>10000)return Response.json({error:'Your message is too long.'},{status:413});
  let body;try{body=JSON.parse(text);}catch{return Response.json({error:'Please check the form and try again.'},{status:400});}
  if(!body||typeof body!=='object')return Response.json({error:'Invalid submission.'},{status:400});
  if(body.website)return Response.json({ok:true});
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  const message=typeof body.message==='string'?body.message.trim():'';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!['driver','owner','dispatcher'].includes(body.role)||!['launch','question','idea'].includes(body.kind)||!['Free','Plus','Pro','Undecided'].includes(body.plan)||message.length>2000||(body.kind!=='launch'&&message.length<5)||body.consent!==true||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return Response.json({error:'Enter a valid email, choose your role and agree to the contact notice. Questions and ideas need a short message.'},{status:400});
  const db=getInquiryDb(),now=Date.now();
  const existing=await db.prepare('SELECT id FROM site_inquiries WHERE id = ?').bind(body.id).first();
  if(existing)return Response.json({ok:true});
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${ip}|${Math.floor(now/86400000)}`));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const count=await db.prepare('SELECT COUNT(*) AS n FROM site_inquiries WHERE request_hash = ? AND created_at > ?').bind(hash,now-900000).first<{n:number}>();
  if((count?.n||0)>=5)return Response.json({error:'A few requests have already been sent. Please try again in 15 minutes.'},{status:429});
  if(body.kind==='launch'){
   const joined=await db.prepare("SELECT id FROM site_inquiries WHERE email = ? AND kind = 'launch'").bind(email).first();
   if(joined)return Response.json({ok:true});
  }
  await db.prepare('INSERT INTO site_inquiries (id,email,role,kind,plan,message,consent_version,created_at,request_hash) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,email,body.role,body.kind,body.plan,message,'contact-v1',now,hash).run();
  return Response.json({ok:true},{status:201});
 }catch(error){console.error('Inquiry storage failed',error instanceof Error?error.name:'Unknown');return Response.json({error:'We could not save your request. Your details are still here; please try again.'},{status:503});}
}
