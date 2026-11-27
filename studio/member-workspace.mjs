import MarkdownIt from 'markdown-it';
import {canMember} from './permissions.mjs';
const md=new MarkdownIt({html:false,linkify:false}).disable('image');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statement=(db,sql,...params)=>db.prepare(sql).bind(...params);
const first=(db,sql,...params)=>statement(db,sql,...params).first();
const all=async(db,sql,...params)=>(await statement(db,sql,...params).all()).results;
const run=(db,sql,...params)=>statement(db,sql,...params).run();
const validId=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9-]{0,99}$/.test(s);
const roles={'':'Prefer not to say',advocate:'Advocate',student:'Law student',researcher:'Legal researcher',corporate:'Corporate professional',other:'Other'};
const clean=(s,max)=>typeof s==='string'&&s.length<=max&&!/[\u0000-\u001f\u007f]/.test(s);
const stamp=n=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(n*1000));
function fail(message,status=400){throw Object.assign(Error(message),{status})}
const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store, private','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const layout=(title,body,status=200)=>new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | Rule &amp; Ratio</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f5f6;color:#17293a;font:15px/1.6 system-ui,sans-serif}header{padding:20px max(20px,4vw);background:#102b43;color:white;border-bottom:3px solid #b89859;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px}header a{color:white}main{max-width:1100px;margin:auto;padding:24px}h1,h2,h3{font-family:Georgia,serif;color:#102b43}h1{font-size:clamp(25px,4vw,38px)}a{color:#234c6e}nav{display:flex;flex-wrap:wrap;gap:16px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}section,article{min-width:0;padding:20px;background:white;border:1px solid #dce2e7;margin:12px 0;overflow-wrap:anywhere}.row{border-bottom:1px solid #dce2e7;padding:12px 0}.row:last-child{border:0}.muted,small{color:#576b7b}label{display:block;margin:10px 0}input,select{width:100%;padding:9px;border:1px solid #9ba8b3;font:inherit;background:white}button,.button{display:inline-block;background:#173d60;color:white;border:0;text-decoration:none;padding:9px 14px;font:inherit;cursor:pointer}form{margin:8px 0}.inline{display:inline-block}.state{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#576b7b}.proof{font:17px/1.7 Georgia,serif}.proof pre{white-space:pre-wrap}.notice{background:#fcf7ed;border-left:3px solid #b89859;padding:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}main{padding:14px}}</style></head><body><header><strong>RULE &amp; RATIO · MEMBER ACCOUNT</strong><nav><a href="/account">Dashboard</a><a href="/account/library">Research library</a><a href="/account/profile">Profile</a><a href="/account/membership">Membership</a></nav></header><main><h1>'+esc(title)+'</h1>'+body+'</main></body></html>',{status,headers});
const go=location=>new Response(null,{status:303,headers:{location,'cache-control':'no-store, private','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'}});
const form=(path,body,label)=>'<form method="post" action="'+esc(path)+'">'+body+'<button type="submit">'+esc(label)+'</button></form>';
const hidden=(name,value)=>'<input type="hidden" name="'+esc(name)+'" value="'+esc(value)+'">';
const field=(name,label,value,max)=>'<label>'+esc(label)+'<input name="'+esc(name)+'" maxlength="'+max+'" value="'+esc(value)+'"></label>';
// The caller supplies a verified session hash, never a member ID from the browser.
const active="EXISTS(SELECT 1 FROM member_sessions s JOIN member_profiles m ON m.id=s.member_id WHERE s.token_hash=? AND s.member_id=? AND s.expires_at>? AND m.status='active')";
const entitled="EXISTS(SELECT 1 FROM membership_entitlements e WHERE e.member_id=? AND e.capability='premium-research' AND e.revoked_at IS NULL AND e.valid_from<=? AND e.valid_until>?)";
async function readForm(req){
 if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')fail('Origin rejected',403);
 if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))fail('Form encoding required',415);
 const reader=req.body?.getReader();if(!reader)fail('Missing form');
 let text='',bytes=0;const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();fail('Request too large',413)}text+=decoder.decode(value,{stream:true})}
 const f=new URLSearchParams(text+decoder.decode());
 for(const k of new Set(f.keys()))if(f.getAll(k).length!==1)fail('Duplicate form field');
 return f;
}
function publicLink(row,site){
 if(!site||typeof row.public_path!=='string'||!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/.test(row.public_path))return null;
 try{const u=new URL(site);if(u.protocol!=='https:'||u.origin!==site||u.username||u.password)return null;return new URL(row.public_path,u).href}catch{return null}
}
function contentRow(row,site,actions=''){
 const link=row.access_level==='premium'&&validId(row.content_key)?'/account/research/'+row.content_key:publicLink(row,site);
 return '<div class="row"><strong>'+(link?'<a href="'+esc(link)+'">'+esc(row.title)+'</a>':esc(row.title))+'</strong><br><small>'+esc(row.kind)+' · '+esc(row.access_level)+'</small>'+actions+'</div>';
}
const empty='<p class="muted">Nothing saved yet.</p>';
export async function memberRoute(req,db,actor,sessionHash,now,publicSite){
 try{
  if(!canMember(actor,'profile:read',{memberId:actor?.id})||typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))fail('Sign in to continue',401);
  const id=actor.id,session=[sessionHash,id,now],u=new URL(req.url);
  const profile=await first(db,'SELECT display_name,profession FROM member_profiles WHERE id=? AND '+active,id,...session);
  if(!profile)fail('Sign in to continue',401);
  const expiry=await first(db,'SELECT MAX(valid_until) AS until FROM membership_entitlements WHERE member_id=? AND capability=? AND revoked_at IS NULL AND valid_from<=? AND valid_until>? AND '+active,id,'premium-research',now,now,...session);
  const paid=Number.isSafeInteger(expiry?.until);
  const readRows=async(query,...args)=>all(db,query+' AND '+active,...args,...session);
  if(req.method==='GET'){
   if(u.pathname==='/account'){
    const counts=await first(db,'SELECT (SELECT COUNT(*) FROM member_bookmarks WHERE member_id=?) AS bookmarks,(SELECT COUNT(*) FROM member_collections WHERE member_id=?) AS collections WHERE '+active,id,id,...session);
    return layout('My account','<p>Welcome'+(profile.display_name?', '+esc(profile.display_name):'')+'. Your research workspace is private.</p><div class="grid"><section><p class="state">Membership</p><h2>'+ (paid?'Premium access active':'Free membership')+'</h2><p>'+ (paid?'Recorded access until '+esc(stamp(expiry.until)):'Read public legal content and build your research library.')+'</p><a href="/account/membership">View membership</a></section><section><h2>Saved research</h2><p>'+esc(counts?.bookmarks??0)+' bookmarks · '+esc(counts?.collections??0)+' collections</p><a href="/account/library">Open your library</a></section><section><h2>My profile</h2><p>'+esc(roles[profile.profession]??'Not specified')+'</p><a href="/account/profile">Edit profile</a></section><section><h2>Account security</h2><p>Login and password recovery are managed by the identity provider.</p>'+form('/logout','','Sign out')+'</section></div>');
   }
   if(u.pathname==='/account/profile')return layout('My profile','<section><p>Optional, self-described information; no professional verification is implied.</p>'+form('/account/profile',field('displayName','Display name',profile.display_name,100)+'<label>Professional category<select name="profession">'+Object.entries(roles).map(([key,label])=>'<option value="'+esc(key)+'"'+(profile.profession===key?' selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>','Save profile')+'</section>');
   if(u.pathname==='/account/membership')return layout('My membership','<section><p class="state">Current access</p><h2>'+(paid?'Premium research enabled':'Free membership')+'</h2><p>'+(paid?'Access expires at '+esc(stamp(expiry.until))+'.':'No active premium entitlement.')+'</p><p class="notice">Checkout, renewal, billing history and cancellation will be enabled after payment integration. This status does not certify payment or recurring subscription terms.</p></section>');
   if(u.pathname==='/account/library'){
    const bookmarks=await all(db,'SELECT c.* FROM member_bookmarks b JOIN member_content_catalog c ON c.content_key=b.content_key WHERE b.member_id=? AND c.status=? AND '+active+' ORDER BY b.created_at DESC LIMIT 500',id,'published',...session);
    const collections=await all(db,'SELECT id,name FROM member_collections WHERE member_id=? AND '+active+' ORDER BY created_at DESC LIMIT 50',id,...session);
    const catalogue=await all(db,'SELECT content_key,title,kind,access_level,public_path FROM member_content_catalog WHERE status=? AND '+active+' ORDER BY title LIMIT 100','published',...session);
    const saved=bookmarks.map(b=>contentRow(b,publicSite,form('/account/bookmarks',hidden('key',b.content_key)+hidden('operation','remove'),'Remove bookmark'))).join('');
    const groups=collections.map(c=>'<div class="row"><a href="/account/collections/'+esc(c.id)+'">'+esc(c.name)+'</a></div>').join('');
    const browse=catalogue.map(c=>contentRow(c,publicSite,form('/account/bookmarks',hidden('key',c.content_key)+hidden('operation','add'),'Save bookmark'))).join('');
    return layout('Research library','<div class="grid"><section><h2>Bookmarks</h2>'+ (saved||empty)+'</section><section><h2>Collections</h2>'+form('/account/collections',field('name','New collection','',80),'Create collection')+(groups||empty)+'</section></div><section><h2>Browse reviewed publications</h2><p class="muted">First 100 catalogue entries. Only publications added by the trusted catalogue process appear here.</p>'+(browse||'<p>No published records have been added to the catalogue.</p>')+'</section>');
   }
   const collection=u.pathname.match(/^\/account\/collections\/([a-z0-9-]{1,100})$/);
   if(collection){
    const c=await first(db,'SELECT id,name FROM member_collections WHERE id=? AND member_id=? AND '+active,collection[1],id,...session);
    if(!c)fail('Collection not found',404);
    const items=await all(db,'SELECT c.* FROM member_collection_items i JOIN member_content_catalog c ON c.content_key=i.content_key WHERE i.collection_id=? AND i.member_id=? AND c.status=? AND '+active+' ORDER BY i.created_at DESC LIMIT 100',c.id,id,'published',...session);
    const bookmarks=await all(db,'SELECT c.content_key,c.title FROM member_bookmarks b JOIN member_content_catalog c ON c.content_key=b.content_key WHERE b.member_id=? AND c.status=? AND '+active+' ORDER BY c.title LIMIT 500',id,'published',...session);
    const options=bookmarks.map(b=>'<option value="'+esc(b.content_key)+'">'+esc(b.title)+'</option>').join('');
    const add=options?form('/account/collections/'+c.id,hidden('operation','add')+'<label>Saved publication<select name="key">'+options+'</select></label>','Add to collection'):'<p>Save a bookmark first.</p>';
    return layout(c.name,'<section>'+add+(items.map(b=>contentRow(b,publicSite,form('/account/collections/'+c.id,hidden('operation','remove')+hidden('key',b.content_key),'Remove from collection'))).join('')||empty)+'</section><section><h2>Collection settings</h2>'+form('/account/collections/'+c.id,hidden('operation','rename')+field('name','Collection name',c.name,80),'Rename')+form('/account/collections/'+c.id,hidden('operation','delete')+'<label><input type="checkbox" name="confirm" value="yes" style="width:auto"> Confirm deletion of this collection</label>','Delete collection')+'</section>');
   }
   const research=u.pathname.match(/^\/account\/research\/([a-z0-9-]{1,100})$/);
   if(research){
    // The private body is selected only when all authorization predicates are true in the same statement.
    const r=await first(db,'SELECT c.title,p.body_markdown FROM member_content_catalog c JOIN member_premium_content p ON p.content_key=c.content_key WHERE c.content_key=? AND c.status=? AND c.access_level=? AND '+active+' AND '+entitled,research[1],'published','premium',...session,id,now,now);
    if(!r)fail('Research unavailable or premium access required',403);
    return layout(r.title,'<article class="proof">'+md.render(r.body_markdown)+'</article><p class="muted">Private research · verify current law and original authorities before relying on this publication.</p>');
   }
   fail('Not found',404);
  }
  if(req.method!=='POST')fail('Method not allowed',405);
  const f=await readForm(req);
  // Explicit field sets prevent role/entitlement injection and cross-account ID substitution.
  const fields=(...allowed)=>{if([...f.keys()].some(k=>!allowed.includes(k)))fail('Unexpected form field')};
  if(u.pathname==='/account/profile'){
   fields('displayName','profession');
   if(!canMember(actor,'profile:update',{memberId:id})||!clean(f.get('displayName'),100)||!Object.hasOwn(roles,f.get('profession')))fail('Invalid profile');
   await run(db,'UPDATE member_profiles SET display_name=?,profession=? WHERE id=? AND '+active,f.get('displayName').trim(),f.get('profession'),id,...session);
   return go('/account/profile');
  }
  if(u.pathname==='/account/bookmarks'){
   fields('key','operation');const key=f.get('key'),op=f.get('operation');
   if(!canMember(actor,'bookmark:manage',{memberId:id})||!validId(key)||!['add','remove'].includes(op))fail('Invalid bookmark');
   if(op==='add')await run(db,'INSERT INTO member_bookmarks(member_id,content_key,created_at) SELECT ?,?,? WHERE '+active+' AND EXISTS(SELECT 1 FROM member_content_catalog WHERE content_key=? AND status=?) AND (SELECT COUNT(*) FROM member_bookmarks WHERE member_id=?)<500 ON CONFLICT DO NOTHING',id,key,now,...session,key,'published',id);
   else await run(db,'DELETE FROM member_bookmarks WHERE member_id=? AND content_key=? AND '+active,id,key,...session);
   return go('/account/library');
  }
  const name=()=>{const n=f.get('name');if(!clean(n,80)||!n.trim())fail('Enter a valid collection name');return n.trim()};
  if(u.pathname==='/account/collections'){
   fields('name');
   await run(db,'INSERT INTO member_collections(id,member_id,name,created_at) SELECT ?,?,?,? WHERE '+active+' AND (SELECT COUNT(*) FROM member_collections WHERE member_id=?)<50 ON CONFLICT DO NOTHING',crypto.randomUUID(),id,name(),now,...session,id);
   return go('/account/library');
  }
  const collection=u.pathname.match(/^\/account\/collections\/([a-z0-9-]{1,100})$/);
  if(collection){
   const cid=collection[1],op=f.get('operation'),owned=await first(db,'SELECT id FROM member_collections WHERE id=? AND member_id=? AND '+active,cid,id,...session);
   if(!owned)fail('Collection not found',404);
   if(op==='rename'){fields('operation','name');await run(db,'UPDATE OR IGNORE member_collections SET name=? WHERE id=? AND member_id=? AND '+active,name(),cid,id,...session)}
   else if(op==='delete'){fields('operation','confirm');if(f.get('confirm')!=='yes')fail('Confirm deletion');await run(db,'DELETE FROM member_collections WHERE id=? AND member_id=? AND '+active,cid,id,...session);return go('/account/library')}
   else if(op==='add'||op==='remove'){
    fields('operation','key');const key=f.get('key');if(!validId(key))fail('Invalid content key');
    if(op==='add')await run(db,'INSERT INTO member_collection_items(collection_id,member_id,content_key,created_at) SELECT ?,?,?,? WHERE '+active+' AND EXISTS(SELECT 1 FROM member_collections WHERE id=? AND member_id=?) AND EXISTS(SELECT 1 FROM member_bookmarks b JOIN member_content_catalog c ON c.content_key=b.content_key WHERE b.member_id=? AND b.content_key=? AND c.status=?) AND (SELECT COUNT(*) FROM member_collection_items WHERE collection_id=? AND member_id=?)<100 ON CONFLICT DO NOTHING',cid,id,key,now,...session,cid,id,id,key,'published',cid,id);
    else await run(db,'DELETE FROM member_collection_items WHERE collection_id=? AND member_id=? AND content_key=? AND '+active,cid,id,key,...session);
   }else fail('Invalid operation');
   return go('/account/collections/'+cid);
  }
  fail('Not found',404);
 }catch(e){return layout('Request not completed','<p>'+esc(e.status?e.message:'The account service could not complete the request.')+'</p><a href="'+(e.status===401?'/login':'/account')+'">'+(e.status===401?'Sign in':'Return to dashboard')+'</a>',e.status??503)}
}
