import {parseDocument} from 'yaml';
import MarkdownIt from 'markdown-it';
import {canStaff} from './permissions.mjs';

const md=new MarkdownIt({html:false,linkify:false}).disable('image');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const uuid=()=>crypto.randomUUID();
const isId=s=>typeof s==='string'&&/^[a-z0-9-]{1,80}$/.test(s);
const isHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const clean=(s,max=1000)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const boss=a=>a.role==='owner'||a.role==='admin';
const statement=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>statement(db,sql,...args).first();
const all=async(db,sql,...args)=>(await statement(db,sql,...args).all()).results;
function problem(message,status=400){throw Object.assign(Error(message),{status})}
const common=['Primary-source authenticity','Legal accuracy','Current law and jurisdiction','Rights, privacy and reporting restrictions','Publication copy','Internal references'];
const specific={article:['Provision or topic scope','Practical guidance and authorities'],judgment:['Case metadata and pinpoints','Ratio and separate opinions','Subsequent judicial treatment'],statute:['Verbatim text and provenance','Versions, commencement and savings','Coverage and original commentary'],news:['Event date and primary document','Reporting distinguished from holding','Corrections and digest references']};
function safeURL(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}}
export async function inspectDraft(kind,raw){
 if(!Object.hasOwn(specific,kind)||!clean(raw,350000)||new TextEncoder().encode(raw).length>500000)problem('Invalid kind or oversized draft');
 let data,body='';
 try{
  if(kind==='statute')data=JSON.parse(raw);
  else{
   const m=raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
   if(!m)problem('Markdown requires YAML front matter');
   const doc=parseDocument(m[1],{uniqueKeys:true});if(doc.errors.length)problem('Invalid YAML metadata');
   data=doc.toJS({maxAliasCount:20});body=m[2];
  }
 }catch(e){problem(e.status?e.message:'Invalid draft source')}
 if(!data||typeof data!=='object'||Array.isArray(data)||!clean(data.title,300)||data.draft!==true||!isId(data.slug))problem('Title, stable slug and explicit draft:true required');
 if(data.reviewer!==undefined||data.reviewedAt!==undefined||data.publishedAt!==undefined)problem('Approval/publication metadata belongs in the review workflow');
 if(kind!=='statute'&&(!clean(data.description,1500)||!clean(data.author,300)||!clean(data.jurisdiction,200)||!Array.isArray(data.areas)||!data.areas.length||!clean(body,350000)))problem('Description, author, jurisdiction, subjects and article body required');
 if(kind==='judgment'&&data.type!=='judgment'||kind==='news'&&data.type!=='news'||kind==='article'&&!['education','research','legislation','procedure','institution'].includes(data.type))problem('Content type must match document kind');
 if(kind==='news'&&data.news?.verification==='verified')problem('News verification belongs in the review workflow');
 let entries;
 if(kind==='statute'){
  if(!Array.isArray(data.provisions)||!data.provisions.length)problem('Statute requires provisions');
  entries=[data.source,...data.provisions.flatMap(p=>Array.isArray(p.versions)?p.versions.map(v=>v.source):[]),...(data.amendments??[]).map(a=>a.source),...(data.instruments??[]).map(i=>i.source)].filter(Boolean).map(s=>({...s,kind:'primary'}));
 }else entries=data.sources??[];
 if(!Array.isArray(entries)||entries.length>100)problem('Invalid source list');
 const sources=[];
 for(const s of entries){
  if(!s||!clean(s.title,500)||!safeURL(s.url)||!['primary','secondary'].includes(s.kind)||s.pinpoint!==undefined&&!clean(s.pinpoint,1000))problem('Invalid source metadata');
  const record={title:s.title,url:s.url,kind:s.kind,pinpoint:s.pinpoint??''};
  record.key=await hash(JSON.stringify(record));
  if(!sources.some(x=>x.key===record.key))sources.push(record);
 }
 return {data,body,sources,hash:await hash(raw)};
}
async function planFor(kind,extra){
 const extras=extra.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(extras.length>20||extras.some(s=>s.length>500))problem('At most 20 additional review issues, 500 characters each');
 const plan=[...new Set([...common,...specific[kind],...extras])];
 return {plan,hash:await hash(JSON.stringify(plan))};
}
function validateEvidence(draft,plan,form){
 if(!draft.sources.some(s=>s.kind==='primary')||draft.sources.some(s=>s.kind==='primary'&&!s.pinpoint))problem('A primary source and all primary pinpoints are required',422);
 if(/(?:^|\n)##\s+(?:Editorial verification pending|Verification before publication|Verification pending|Before publication|Editorial caution)\s*(?:\r?\n|$)/i.test(draft.body))problem('Resolve internal editorial verification sections before approval',422);
 if(draft.data.type==='judgment'&&(!draft.data.judgment?.judgmentUrl||!draft.sources.some(s=>s.kind==='primary'&&s.url===draft.data.judgment.judgmentUrl)))problem('Judgment needs a matching primary judgment source',422);
 if(draft.data.provisions&&(!draft.data.status||draft.data.provisions.some(p=>!clean(p.commentary,100000)||!Array.isArray(p.versions)||!p.versions.length)))problem('Statute needs recorded status, reviewed versions and original commentary',422);
 const checks=plan.map((label,i)=>{const note=form.get('check-note-'+i);if(form.get('check-'+i)!=='yes'||!clean(note,4000))problem('Unresolved review issue: '+label,422);return {label,note}});
 const sources=draft.sources.map(s=>{const note=form.get('source-note-'+s.key);if(form.get('source-'+s.key)!=='yes'||!clean(note,4000))problem('Unverified source: '+s.title,422);return {key:s.key,note}});
 return {checks,sources};
}
async function readForm(req){
 if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))problem('Form encoding required',415);
 const reader=req.body?.getReader();if(!reader)problem('Missing form');
 const decoder=new TextDecoder();let bytes=0,body='';
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1800000){await reader.cancel();problem('Request too large',413)}body+=decoder.decode(value,{stream:true})}
 body+=decoder.decode();const form=new URLSearchParams(body);
 for(const k of new Set(form.keys()))if(form.getAll(k).length!==1)problem('Duplicate form field');
 return form;
}
const activeSQL="EXISTS (SELECT 1 FROM staff_accounts a WHERE a.id=? AND a.status='active' AND a.role=?)";
const accessSQL="( ? IN ('owner','admin') OR EXISTS (SELECT 1 FROM editorial_assignments x WHERE x.document_id=d.id AND x.staff_id=? AND x.capability=?))";
async function mutation(db,actor,guard,params,writes,action,id,revision,now,details={}){
 const tx=uuid();
 // D1 batch is transactional; guard CHECK violation rolls back all writes.
 const statements=[statement(db,'INSERT INTO studio_mutation_guards(id,allowed) VALUES (?,CASE WHEN '+activeSQL+' AND ('+guard+') THEN 1 ELSE 0 END)',tx,actor.id,actor.role,...params),...writes,statement(db,'INSERT INTO audit_events(id,actor_staff_id,action,target_key,revision_hash,occurred_at,details_json) VALUES (?,?,?,?,?,?,?)',uuid(),actor.id,action,id,revision,now,JSON.stringify(details)),statement(db,'DELETE FROM studio_mutation_guards WHERE id=?',tx)];
 try{await db.batch(statements)}catch{problem('Write rejected or record changed. Reload the document before retrying.',409)}
}
const form=(action,body,button)=>'<form method="post" action="'+esc(action)+'">'+body+'<button type="submit">'+esc(button)+'</button></form>';
const input=(name,label,value='',type='text')=>'<label>'+esc(label)+'<input type="'+esc(type)+'" name="'+esc(name)+'" value="'+esc(value)+'" required></label>';
const area=(name,label,value='')=>'<label>'+esc(label)+'<textarea name="'+esc(name)+'" rows="5">'+esc(value)+'</textarea></label>';
const hidden=(name,value)=>'<input type="hidden" name="'+esc(name)+'" value="'+esc(value)+'">';
const verifyBox=(name,label)=>'<label class="check"><input type="checkbox" name="'+esc(name)+'" value="yes"> '+esc(label)+'</label>';
const path=id=>'/studio/doc/'+id;
const layout=(title,body,status=200)=>new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | Rule &amp; Ratio Studio</title><style> *{box-sizing:border-box}body{margin:0;background:#f3f5f6;color:#17293a;font:15px/1.6 system-ui,sans-serif}header{background:#102b43;color:white;padding:18px max(20px,4vw);border-bottom:3px solid #b89859;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}header a{color:white}main{max-width:1300px;margin:auto;padding:24px}h1,h2,h3{font-family:Georgia,serif;color:#102b43}h1{font-size:clamp(24px,3vw,36px)}a{color:#234c6e}section,article,aside{min-width:0;background:white;border:1px solid #dce2e7;padding:18px;margin:12px 0;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px}label{display:block;margin:10px 0;font-weight:600}textarea,input:not([type=checkbox]),select{width:100%;padding:10px;border:1px solid #9ba8b3;font:inherit;background:white}textarea[name=raw]{min-height:340px;font:13px/1.5 monospace}button{background:#173d60;border:0;color:white;padding:10px 16px;font:inherit;cursor:pointer}small,.muted{color:#5b6a78}.check{font-weight:400}.row{border-bottom:1px solid #e0e4e8;padding:12px 0}.row a{font-weight:600}.proof{font:17px/1.7 Georgia,serif}.proof pre,pre{white-space:pre-wrap;overflow-wrap:anywhere}.proof img{display:none}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}.state{font-size:12px;color:#465c70;text-transform:uppercase;letter-spacing:.06em}.warning{background:#fcf7ed;padding:10px;border-left:3px solid #b89859}code{overflow-wrap:anywhere} @media(max-width:780px){.grid{grid-template-columns:1fr}main{padding:12px}}</style></head><body><header><strong>RULE &amp; RATIO · EDITORIAL STUDIO</strong><nav><a href="/studio">Editorial queue</a> · <a href="/cdn-cgi/access/logout">Sign out</a></nav></header><main><h1>'+esc(title)+'</h1>'+body+'</main></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, private','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
const go=url=>new Response(null,{status:303,headers:{location:url,'cache-control':'no-store, private','referrer-policy':'no-referrer'}});
async function getDoc(db,actor,id){
 const d=await first(db,'SELECT d.*,r.content,r.author_id FROM editorial_documents d JOIN editorial_revisions r ON r.document_id=d.id AND r.sha256=d.current_revision_hash WHERE d.id=?',id);
 if(!d)problem('Document not found',404);
 const capabilities=(await all(db,'SELECT capability FROM editorial_assignments WHERE document_id=? AND staff_id=?',id,actor.id)).map(x=>x.capability);
 const ctx={document:d,assignedCapabilities:capabilities};
 if(!canStaff(actor,'document:read',ctx))problem('Document not found',404);
 return {d,ctx};
}
function docGuard(d,actor,cap){
 return {sql:'EXISTS (SELECT 1 FROM editorial_documents d WHERE d.id=? AND d.current_revision_hash=? AND d.review_plan_hash=? AND d.status=? AND d.generation=? AND '+accessSQL+')',args:[d.id,d.current_revision_hash,d.review_plan_hash,d.status,d.generation,actor.role,actor.id,cap]};
}
export async function editorialRoute(req,db,actor,now){
 try{
  if(!canStaff(actor,'studio:read'))problem('Access denied',403);
  const url=new URL(req.url);
  if(req.method==='POST'&&(req.headers.get('origin')!==url.origin||req.headers.get('sec-fetch-site')==='cross-site'))problem('Origin rejected',403);
  if(url.pathname==='/studio'){
   if(req.method!=='GET')problem('Method not allowed',405);
   const rows=await all(db,"SELECT d.id,d.title,d.kind,d.status,d.updated_at FROM editorial_documents d WHERE ? IN ('owner','admin') OR EXISTS(SELECT 1 FROM editorial_assignments x WHERE x.document_id=d.id AND x.staff_id=?) ORDER BY d.updated_at DESC,d.id LIMIT 200",actor.role,actor.id);
   const create=boss(actor)?'<section><h2>Create private draft</h2>'+form('/studio/create','<label>Document kind<select name="kind"><option value="article">Article</option><option value="judgment">Judgment</option><option value="statute">Statute</option><option value="news">News</option></select></label>'+area('raw','Draft Markdown with YAML front matter, or statutory JSON')+area('issues','Additional verification issues, one per line'),'Create draft')+'</section>':'';
   return layout('Editorial queue','<p>Signed in as '+esc(actor.role)+'. Private workspace; publishing and billing are disabled.</p><div class="grid"><section><h2>Assigned and accessible documents</h2><p class="muted">Up to 200 most recently updated records.</p>'+ (rows.map(d=>'<div class="row"><a href="'+path(d.id)+'">'+esc(d.title||d.id)+'</a><br><small>'+esc(d.kind)+' · '+esc(d.status)+'</small></div>').join('')||'<p>No documents yet.</p>')+'</section><aside>'+create+'</aside></div>');
  }
  if(url.pathname==='/studio/create'&&req.method==='POST'){
   if(!canStaff(actor,'document:create'))problem('Access denied',403);
   const f=await readForm(req),kind=f.get('kind'),raw=f.get('raw'),draft=await inspectDraft(kind,raw),p=await planFor(kind,f.get('issues')??''),id=uuid();
   await mutation(db,actor,"? IN ('owner','admin')",[actor.role],[
    statement(db,'INSERT INTO editorial_documents(id,kind,current_revision_hash,created_at,updated_at,title,review_plan_json,review_plan_hash,last_editor_id) VALUES (?,?,?,?,?,?,?,?,?)',id,kind,draft.hash,now,now,draft.data.title,JSON.stringify(p.plan),p.hash,actor.id),
    statement(db,'INSERT INTO editorial_revisions(document_id,sha256,content,author_id,created_at) VALUES (?,?,?,?,?)',id,draft.hash,raw,actor.id,now)
   ],'draft-created',id,draft.hash,now);
   return go(path(id));
  }
  const match=url.pathname.match(/^\/studio\/doc\/([a-z0-9-]{1,80})(?:\/(edit|submit|review|reopen|assign))?$/);
  if(!match)problem('Not found',404);
  const [,id,action]=match,{d,ctx}=await getDoc(db,actor,id),draft=await inspectDraft(d.kind,d.content);
  const plan=JSON.parse(d.review_plan_json);
  if(!Array.isArray(plan)||!plan.length||await hash(JSON.stringify(plan))!==d.review_plan_hash||draft.hash!==d.current_revision_hash)problem('Stored revision or review plan failed integrity check',409);
  const editable=canStaff(actor,'document:edit',ctx),reviewable=canStaff(actor,'document:review',ctx);
  const versionFields=hidden('hash',d.current_revision_hash)+hidden('plan',d.review_plan_hash)+hidden('status',d.status)+hidden('generation',d.generation);
  if(req.method==='GET'&&!action){
   const sourceList=draft.sources.map(s=>'<div class="row"><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title)+'</a><br><small>'+esc(s.kind)+' · '+esc(s.pinpoint||'Missing pinpoint')+'</small></div>').join('');
   const preview=d.kind==='statute'?draft.data.provisions.map(p=>'<h3>'+esc(p.number)+' — '+esc(p.heading)+'</h3>'+ (p.versions??[]).map(v=>'<p class="muted">Recorded from: '+esc(v.effectiveFrom??'Undated')+'</p><pre>'+esc(v.text)+'</pre>').join('')+'<p>'+esc(p.commentary)+'</p>').join(''):md.render(draft.body);
   const editor=editable?'<section><h2>Edit saved draft</h2>'+form(path(id)+'/edit',versionFields+area('raw','Draft source',d.content),'Save new revision')+(d.status==='draft'?form(path(id)+'/submit',versionFields,'Submit for legal review'):'')+'</section>':'';
   const reviewer=reviewable?'<section><h2>Legal review</h2><p>Review the exact saved version. Approval is not publication.</p>'+form(path(id)+'/review',versionFields+input('reviewerName','Actual reviewer name')+area('summary','Review summary')+plan.map((s,i)=>verifyBox('check-'+i,s)+area('check-note-'+i,'Evidence and resolution')).join('')+draft.sources.map(s=>verifyBox('source-'+s.key,'Verified: '+s.title)+area('source-note-'+s.key,'Verification evidence')).join('')+verifyBox('solo','Owner self-review acknowledgement (if you authored this revision)')+verifyBox('confirm','I personally completed this legal review')+'<label>Decision<select name="decision"><option value="blocked">Return for corrections</option><option value="approved">Approve exact revision</option></select></label>','Record review')+'</section>':'';
   const reviewRows=await all(db,'SELECT decision,revision_hash,created_at,evidence_json FROM editorial_reviews WHERE document_id=? ORDER BY created_at DESC LIMIT 10',id);
   const history='<section><h2>Review history</h2>'+ (reviewRows.map(r=>'<div class="row"><strong>'+esc(r.decision)+'</strong><p>'+esc(JSON.parse(r.evidence_json).summary)+'</p><small>'+esc(r.revision_hash)+'</small></div>').join('')||'<p>No reviews.</p>')+'</section>';
   const revisions=await all(db,'SELECT sha256,created_at FROM editorial_revisions WHERE document_id=? ORDER BY created_at DESC LIMIT 20',id);
   const revisionList='<section><h2>Revision history</h2>'+revisions.map(r=>'<p><code>'+esc(r.sha256)+'</code><br><small>'+esc(new Date(r.created_at*1000).toISOString())+'</small></p>').join('')+'</section>';
   let admin='';
   if(boss(actor)){
    const staff=await all(db,"SELECT id,role FROM staff_accounts WHERE status='active' AND role IN ('author','reviewer') ORDER BY id LIMIT 100");
    const assignments=await all(db,'SELECT staff_id,capability FROM editorial_assignments WHERE document_id=? ORDER BY staff_id',id);
    admin='<section><h2>Assignments</h2>'+assignments.map(a=>'<p>'+esc(a.staff_id)+' · '+esc(a.capability)+'</p>').join('')+(staff.length?form(path(id)+'/assign',versionFields+'<label>Staff identity<select name="staffId">'+staff.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.id)+' · '+esc(s.role)+'</option>').join('')+'</select></label><label>Action<select name="operation"><option value="grant">Assign role capability</option><option value="revoke">Remove assignment</option></select></label>','Update assignment'):'<p>No active authors or reviewers provisioned.</p>')+(d.status==='approved'?form(path(id)+'/reopen',versionFields+area('reason','Reason for reopening'),'Reopen approved draft'):'')+'</section>';
   }
   return layout(d.title,'<p class="state">'+esc(d.kind)+' · '+esc(d.status)+'</p><p class="muted">Revision: <code>'+esc(d.current_revision_hash)+'</code></p><div class="warning">Private proof — not a public Astro rendering. Approval does not deploy content.</div><div class="grid"><div><article class="proof"><h2>'+esc(draft.data.title)+'</h2><p>'+esc(draft.data.description)+'</p>'+preview+'</article>'+editor+reviewer+history+'</div><aside><h2>Supporting authorities</h2>'+sourceList+'<h2>Review requirements</h2>'+plan.map(s=>'<p>'+esc(s)+'</p>').join('')+admin+revisionList+'</aside></div>');
  }
  if(req.method!=='POST'||!action)problem('Method not allowed',405);
  const f=await readForm(req);
  if(f.get('hash')!==d.current_revision_hash||f.get('plan')!==d.review_plan_hash||f.get('status')!==d.status||f.get('generation')!==String(d.generation))problem('Document changed. Reload.',409);
  const guard=docGuard(d,actor,action==='review'?'review':'edit');
  if(action==='edit'){
   if(!editable)problem('Access denied',403);
   const raw=f.get('raw'),next=await inspectDraft(d.kind,raw);
   if(next.data.slug!==draft.data.slug)problem('Stable slug cannot be changed');
   if(next.hash===draft.hash)return go(path(id));
   await mutation(db,actor,guard.sql,guard.args,[
    statement(db,'INSERT INTO editorial_revisions(document_id,sha256,content,author_id,created_at) VALUES (?,?,?,?,?) ON CONFLICT(document_id,sha256) DO NOTHING',id,next.hash,raw,actor.id,now),
    statement(db,"UPDATE editorial_documents SET current_revision_hash=?,title=?,status='draft',updated_at=?,generation=generation+1,last_editor_id=? WHERE id=?",next.hash,next.data.title,now,actor.id,id)
   ],'draft-edited',id,next.hash,now);
  }else if(action==='submit'){
   if(!editable||d.status!=='draft')problem('Access denied',403);
   await mutation(db,actor,guard.sql,guard.args,[statement(db,"UPDATE editorial_documents SET status='in-review',updated_at=?,generation=generation+1 WHERE id=?",now,id)],'submitted-for-review',id,draft.hash,now);
  }else if(action==='review'){
   if(!reviewable)problem('Access denied',403);
   const decision=f.get('decision'),summary=f.get('summary'),reviewerName=f.get('reviewerName');
   if(!['approved','blocked'].includes(decision)||!clean(summary,4000)||!clean(reviewerName,200)||f.get('confirm')!=='yes')problem('Explicit named review and summary required',422);
   const self=d.author_id===actor.id||d.last_editor_id===actor.id;
   if(decision==='approved'&&self&&(actor.role!=='owner'||f.get('solo')!=='yes'))problem('Independent review required, except explicitly acknowledged owner self-review',422);
   const evidence={reviewerName,summary,selfReview:self,...(decision==='approved'?validateEvidence(draft,plan,f):{checks:[],sources:[]})};
   await mutation(db,actor,guard.sql,guard.args,[
    statement(db,'INSERT INTO editorial_reviews(id,document_id,revision_hash,reviewer_id,decision,evidence_json,review_plan_hash,created_at) VALUES (?,?,?,?,?,?,?,?)',uuid(),id,draft.hash,actor.id,decision,JSON.stringify(evidence),d.review_plan_hash,now),
    statement(db,'UPDATE editorial_documents SET status=?,updated_at=?,generation=generation+1 WHERE id=?',decision==='approved'?'approved':'draft',now,id)
   ],'review-'+decision,id,draft.hash,now);
  }else if(action==='reopen'){
   if(!boss(actor)||d.status!=='approved'||!clean(f.get('reason'),4000))problem('Administrator and reason required',403);
   await mutation(db,actor,guard.sql,guard.args,[statement(db,"UPDATE editorial_documents SET status='draft',updated_at=?,generation=generation+1 WHERE id=?",now,id)],'approval-reopened',id,draft.hash,now,{reason:f.get('reason')});
  }else if(action==='assign'){
   if(!boss(actor)||!isId(f.get('staffId'))||!['grant','revoke'].includes(f.get('operation')))problem('Invalid assignment',403);
   const target=await first(db,'SELECT id,role,status FROM staff_accounts WHERE id=?',f.get('staffId'));
   if(!target||target.status!=='active'||!['author','reviewer'].includes(target.role))problem('Select active author or reviewer',422);
   const cap=target.role==='author'?'edit':'review',grant=f.get('operation')==='grant';
   await mutation(db,actor,guard.sql+" AND EXISTS(SELECT 1 FROM staff_accounts WHERE id=? AND status='active' AND role=?)",[...guard.args,target.id,target.role],[grant?statement(db,'INSERT INTO editorial_assignments(document_id,staff_id,capability) VALUES (?,?,?) ON CONFLICT DO NOTHING',id,target.id,cap):statement(db,'DELETE FROM editorial_assignments WHERE document_id=? AND staff_id=? AND capability=?',id,target.id,cap),statement(db,'UPDATE editorial_documents SET generation=generation+1,updated_at=? WHERE id=?',now,id)],grant?'assignment-granted':'assignment-revoked',id,draft.hash,now,{staffId:target.id,capability:cap});
  }else problem('Not found',404);
  return go(path(id));
 }catch(e){return layout('Request not completed','<p>'+esc(e.status?e.message:'The workspace could not complete the request.')+'</p><a href="/studio">Return to queue</a>',e.status??503)}
}
