import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync,lstatSync} from 'node:fs';
import {join,resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseDocument,stringify} from 'yaml';

const hash=b=>createHash('sha256').update(b).digest('hex');
const nonempty=v=>typeof v==='string'&&Boolean(v.trim());
const slugOK=v=>typeof v==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v);
const today=()=>new Date().toISOString().slice(0,10);
const dateOK=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=today();
const rel=(root,p)=>relative(root,p).split('\\').join('/');
const loadJSON=p=>JSON.parse(readFileSync(p,'utf8'));
const safeURL=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
const fail=m=>{throw Error(m)};
function walk(dir,ext){
 if(!existsSync(dir))return [];
 if(lstatSync(dir).isSymbolicLink())fail('Refusing symlink directory: '+dir);
 return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
  if(e.isSymbolicLink())fail('Refusing symlink: '+join(dir,e.name));
  const p=join(dir,e.name);return e.isDirectory()?walk(p,ext):e.isFile()&&p.endsWith(ext)?[p]:[];
 });
}
export function parseArticle(raw){
 const m=raw.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
 if(!m)fail('Missing Markdown front matter');
 const doc=parseDocument(m[1],{uniqueKeys:true});
 if(doc.errors.length)fail(doc.errors.map(e=>e.message).join('; '));
 const data=doc.toJS({maxAliasCount:20});
 if(!data||typeof data!=='object'||Array.isArray(data))fail('Expected mapping in front matter');
 return {data,body:m[2]};
}
const common=['primary-source-authenticity','legal-accuracy','current-law-and-jurisdiction','rights-privacy-and-reporting','publication-copy','internal-links'];
export function checklist(type){
 return [...common,...(type==='judgment'?['case-metadata-and-pinpoints','ratio-and-separate-opinions','subsequent-judicial-treatment']:type==='news'?['event-date-and-document','reporting-vs-holding','corrections-and-digest-links']:type==='statute'?['verbatim-text-and-provenance','versions-commencement-and-savings','coverage-and-original-commentary']:['provision-or-topic-scope','practical-guidance-and-authorities'])];
}
function sourcesFor(d,type){
 const entries=type==='statute'?[d.source,...(d.provisions??[]).flatMap(p=>(p.versions??[]).map(v=>v.source)),...(d.amendments??[]).map(a=>a.source)].filter(Boolean).map(s=>({...s,kind:'primary'})):(d.sources??[]);
 if(!Array.isArray(entries))fail('Sources must be an array');
 const seen=new Set();
 return entries.map(s=>{
  if(!s||!nonempty(s.title)||!safeURL(s.url)||!['primary','secondary'].includes(s.kind))fail('Invalid source metadata');
  const r={title:s.title,url:s.url,kind:s.kind,pinpoint:s.pinpoint??''};
  return {...r,key:hash(JSON.stringify(r)).slice(0,24)};
 }).filter(s=>!seen.has(s.key)&&seen.add(s.key));
}
export function makeItem(path,raw,kind){
 const {data,body}=kind==='article'?parseArticle(raw):{data:JSON.parse(raw),body:''};
 if(!data||typeof data!=='object'||!nonempty(data.title))fail('Missing title: '+path);
 const template=path==='src/content/articles/example-draft.md'||path==='src/content/statutes/example-draft.json';
 if(!template&&!slugOK(data.slug))fail('Missing/invalid slug: '+path);
 if(data.draft!==undefined&&typeof data.draft!=='boolean')fail('Invalid draft flag: '+path);
 const type=kind==='article'?data.type:'statute';
 if(!['news','judgment','legislation','procedure','research','education','institution','statute'].includes(type))fail('Invalid type: '+path);
 return {id:kind+'-'+(data.slug??'example-draft'),path,kind,type,title:data.title,slug:data.slug??null,areas:data.areas??[],draft:data.draft!==false,template,sha256:hash(raw),sources:sourcesFor(data,type),requiredChecks:checklist(type),data,body,notes:[],candidates:[]};
}
export function createReview(item){
 return {version:1,id:item.id,sha256:item.sha256,decision:'in-review',reviewer:'',reviewedAt:'',note:'',checks:Object.fromEntries(item.requiredChecks.map(k=>[k,false])),sources:Object.fromEntries(item.sources.map(s=>[s.key,{verified:false,note:''}]))};
}
export function reviewState(item,record){
 if(item.template)return {status:'template',missing:[]};
 if(!item.draft)return {status:'published',missing:[]};
 if(!record)return {status:'queued',missing:['No review record']};
 if(record.id!==item.id||record.version!==1)return {status:'invalid',missing:['Review identity/version mismatch']};
 if(record.sha256!==item.sha256)return {status:'stale',missing:['Draft changed after review record creation']};
 if(!['in-review','blocked','approved'].includes(record.decision))return {status:'invalid',missing:['Invalid review decision']};
 const missing=[];
 if(!nonempty(record.reviewer))missing.push('Named human reviewer');
 if(!dateOK(record.reviewedAt))missing.push('Actual non-future review date (YYYY-MM-DD)');
 if(!nonempty(record.note))missing.push('Review summary');
 for(const k of item.requiredChecks)if(record.checks?.[k]!==true)missing.push('Check: '+k);
 if(!item.sources.some(s=>s.kind==='primary'))missing.push('Primary source');
 for(const s of item.sources){
  const v=record.sources?.[s.key];
  if(v?.verified!==true||!nonempty(v.note))missing.push('Source verification: '+s.title+' '+s.pinpoint);
  if(s.kind==='primary'&&!nonempty(s.pinpoint))missing.push('Primary source pinpoint: '+s.title);
 }
 if(item.kind==='article'){
  if(!nonempty(item.data.author)||!nonempty(item.data.description)||!item.areas.length||!nonempty(item.data.jurisdiction))missing.push('Required article metadata');
  if(/(?:^|\n)##\s+(?:Verification pending|Editorial verification pending|Verification before publication|Editorial checks(?: before publication)?|Before publication|Editorial caution|Editorial review points|Editorial checks before publication)\s*(?:\r?\n|$)/i.test(item.body))missing.push('Resolve/remove internal editorial verification sections before final review');
 }else{
  if(!['in-force','partly-in-force','repealed','not-commenced','uncertain'].includes(item.data.status))missing.push('Reviewed statutory status');
  if(!item.data.provisions?.length||item.data.provisions.some(p=>!nonempty(p.commentary)||!p.versions?.length))missing.push('Statutory provisions with reviewed original commentary');
 }
 return {status:record.decision==='blocked'?'blocked':record.decision==='approved'?(missing.length?'incomplete':'ready'):'in-review',missing};
}
export function inventory(root){
 const items=[];
 for(const p of walk(join(root,'src/content/articles'),'.md'))items.push(makeItem(rel(root,p),readFileSync(p,'utf8'),'article'));
 for(const p of walk(join(root,'src/content/statutes'),'.json'))items.push(makeItem(rel(root,p),readFileSync(p,'utf8'),'statute'));
 for(const p of walk(join(root,'.rr-import'),'.json').filter(p=>p.endsWith('/draft.json')||p.endsWith('\\draft.json')))items.push(makeItem(rel(root,p),readFileSync(p,'utf8'),'import'));
 const ids=new Set();
 for(const i of items){if(ids.has(i.id))fail('Duplicate editorial ID: '+i.id);ids.add(i.id)}
 const bySlug=new Map(items.filter(i=>i.kind==='article'&&i.slug).map(i=>[i.slug,i]));
 const byPath=new Map(items.map(i=>[i.path,i]));
 const acquisition=[];
 for(const p of walk(join(root,'docs/acquisition'),'.json')){
  const d=loadJSON(p);
  if(Array.isArray(d.provisions)&&nonempty(d.slug)){
   const candidates=[];
   const act=items.find(i=>i.kind==='statute'&&i.slug===d.slug&&!i.draft);
   for(const v of d.provisions){
    const i=byPath.get(v.draftArticle)||bySlug.get(v.articleSlug);
    if(!i)continue;
    const provision=v.slug??v.id??null;
    const actual=provision&&act?.data.provisions?.find(p=>p.slug===provision);
    const candidate={act:d.slug,provision,article:i.slug,status:actual?'matching-reviewed-provision-manual-check':'unresolved-manual-check'};
    i.candidates.push(candidate);candidates.push(candidate);
    i.notes.push('Acquisition source map: '+rel(root,p));
   }
   acquisition.push({path:rel(root,p),title:d.title??d.slug,slug:d.slug,state:d.state??'unknown',source:d.source?.url??'',sourceStatus:d.source?.status??d.source?.retrieval??'',count:d.provisions.length,candidates});
  }
  if(Array.isArray(d.cases))for(const c of d.cases){
   const i=bySlug.get(c.slug);if(i)i.notes.push('Research status: '+(c.status??c.sourceStatus??'not recorded')+' ('+rel(root,p)+')');
  }
 }
 return {items,acquisition};
}
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(u,label)=>safeURL(u)?'<a href="'+escape(u)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>':escape(label);
export function dashboard(report){
 const rows=report.items.map(i=>'<details class="entry" data-status="'+escape(i.status)+'" data-type="'+escape(i.type)+'"><summary><span class="status">'+escape(i.status)+'</span><strong>'+escape(i.title)+'</strong><small>'+escape(i.type)+' · '+escape(i.id)+'</small></summary><div class="body"><p><code>'+escape(i.path)+'</code></p><p>SHA-256: <code>'+escape(i.sha256)+'</code></p><p>'+escape(i.notes.join(' | '))+'</p><h3>Sources — verification is manual</h3><ul>'+i.sources.map(s=>'<li>'+link(s.url,s.title)+' — '+escape(s.kind)+' · '+escape(s.pinpoint||'No pinpoint')+' · '+escape(s.verified?'recorded verified':'not verified')+'</li>').join('')+'</ul><h3>Outstanding checks</h3><ul>'+i.missing.map(m=>'<li>'+escape(m)+'</li>').join('')+'</ul><h3>Statutory link candidates</h3><ul>'+i.candidates.map(c=>'<li>'+escape(c.act+'/'+(c.provision??'(manual mapping)')+' — '+c.status)+'</li>').join('')+'</ul><p>Review record: <code>.rr-editorial/reviews/'+escape(i.id)+'.json</code></p></div></details>').join('');
 const acquisition=report.acquisition.map(a=>'<tr><td>'+escape(a.title)+'</td><td>'+escape(a.state)+'</td><td>'+escape(a.count)+'</td><td>'+link(a.source,'Source')+' · '+escape(a.sourceStatus)+'</td><td>'+escape(a.candidates.filter(c=>c.status.startsWith('matching')).length)+' / '+escape(a.candidates.length)+'</td></tr>').join('');
 const counts=Object.entries(report.counts).map(([k,v])=>'<div class="metric"><b>'+escape(v)+'</b><small>'+escape(k)+'</small></div>').join('');
 const opts=(values)=>values.map(v=>'<option value="'+escape(v)+'">'+escape(v)+'</option>').join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Rule &amp; Ratio — Editorial desk</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#202b35;background:#f5f6f8;margin:0}main{max-width:1200px;margin:auto;padding:28px}h1{font:32px Georgia,serif;margin:0}h2{font:24px Georgia,serif}small{display:block;color:#53606d}p{overflow-wrap:anywhere}a{color:#155693}.metrics{display:flex;gap:12px;flex-wrap:wrap}.metric{background:white;border:1px solid #d8dfe5;padding:12px 20px;border-radius:6px;min-width:85px}.metric b{font-size:24px}.controls{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}input,select{font:inherit;padding:9px;border:1px solid #b6c0ca;border-radius:4px;background:white}input{flex:1;min-width:190px}.entry{background:white;border:1px solid #d8dfe5;border-radius:5px;margin:7px 0}.entry summary{cursor:pointer;padding:13px}.entry summary strong{margin-left:10px}.entry summary small{margin-left:68px}.status{display:inline-block;background:#edf0f3;border-radius:4px;padding:2px 7px;font-size:12px}.body{border-top:1px solid #d8dfe5;padding:0 18px 12px}code{font-size:12px;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;background:white}td,th{text-align:left;padding:10px;border:1px solid #d8dfe5;vertical-align:top}.table{overflow:auto}[hidden]{display:none!important}</style></head><body><main><h1>Rule &amp; Ratio — Editorial desk</h1><p>Local report only · '+escape(report.generatedAt)+' · A recorded review is not authentication or publication. Repository drafts may already be visible on public GitHub.</p><div class="metrics">'+counts+'</div><h2>Article and statute review queue</h2><div class="controls"><input id="q" aria-label="Search drafts" placeholder="Search titles, slugs, sources and notes"><select id="status" aria-label="Review status"><option value="">All statuses</option>'+opts(Object.keys(report.counts))+'</select><select id="type" aria-label="Publication type"><option value="">All types</option>'+opts([...new Set(report.items.map(i=>i.type))])+'</select></div><p id="visible" aria-live="polite"></p>'+rows+'<h2>Statutory acquisition and link candidates</h2><div class="table"><table><thead><tr><th>Act</th><th>Acquisition status</th><th>Selected groups</th><th>Source status</th><th>Matching / candidate links</th></tr></thead><tbody>'+acquisition+'</tbody></table></div></main><script>const q=document.getElementById("q"),s=document.getElementById("status"),t=document.getElementById("type"),rows=[...document.querySelectorAll(".entry")];function filter(){let n=0;for(const r of rows){r.hidden=!(r.textContent.toLowerCase().includes(q.value.toLowerCase())&&(!s.value||r.dataset.status===s.value)&&(!t.value||r.dataset.type===t.value));if(!r.hidden)n++}document.getElementById("visible").textContent=n+" records shown"}q.addEventListener("input",filter);s.addEventListener("change",filter);t.addEventListener("change",filter);filter();</script></body></html>';
}
function reviewPath(root,id){if(!slugOK(id))fail('Invalid editorial ID');return join(root,'.rr-editorial','reviews',id+'.json')}
function readReview(root,id){const p=reviewPath(root,id);if(!existsSync(p))return null;if(lstatSync(p).isSymbolicLink())fail('Refusing symlink review: '+p);return loadJSON(p)}
export function buildReport(root){
 const {items,acquisition}=inventory(root),counts={queued:0,'in-review':0,blocked:0,stale:0,incomplete:0,invalid:0,ready:0,published:0,template:0};
 const result=items.map(({data,body,...i})=>{
  const rec=readReview(root,i.id),state=reviewState({...i,data,body},rec);
  counts[state.status]++;
  return {...i,...state,sources:i.sources.map(s=>({...s,verified:rec?.sha256===i.sha256&&rec?.sources?.[s.key]?.verified===true&&nonempty(rec?.sources?.[s.key]?.note)}))};
 });
 return {generatedAt:new Date().toISOString(),counts,items:result,acquisition};
}
export function prepare(item,record,publishDate){
 if(reviewState(item,record).status!=='ready')fail('Draft is not ready; complete current human review first');
 if(!dateOK(publishDate)||publishDate<record.reviewedAt)fail('Actual publication date must be non-future and not precede review');
 const d={...item.data,reviewer:record.reviewer.trim(),reviewedAt:record.reviewedAt,draft:false};
 if(item.kind==='article'){
  d.publishedAt=publishDate;
  if(d.type==='news'){if(!d.news)fail('Missing news metadata');d.news={...d.news,verification:'verified'}}
  return '---\n'+stringify(d,{lineWidth:0})+'---\n'+item.body;
 }
 return JSON.stringify(d,null,2)+'\n';
}
function writeExclusive(p,text){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,text,{flag:'wx'})}
function main(){
 const root=process.cwd(),[cmd,id,day,...extra]=process.argv.slice(2),out=join(root,'.rr-editorial');
 if(cmd==='queue'&&!id){
  const report=buildReport(root);mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'queue.json'),JSON.stringify(report,null,2)+'\n');
  writeFileSync(join(out,'index.html'),dashboard(report));
  console.log(JSON.stringify(report.counts));console.log('Local dashboard: .rr-editorial/index.html — no publication or external retrieval.');return;
 }
 if(!['template','prepare'].includes(cmd)||!id||extra.length||(cmd==='template'&&day)||(cmd==='prepare'&&!day))fail('Usage: editorial:queue | editorial:template -- <id> | editorial:prepare -- <id> <YYYY-MM-DD>');
 const item=inventory(root).items.find(i=>i.id===id);
 if(!item||item.template||!item.draft)fail('Select a substantive unpublished item');
 if(cmd==='template'){
  writeExclusive(reviewPath(root,id),JSON.stringify(createReview(item),null,2)+'\n');console.log('Review template created; edit with actual verification. No checks pre-approved.');return;
 }
 const record=readReview(root,id),text=prepare(item,record,day);
 const p=join(out,'prepared',id+(item.kind==='article'?'.md':'.json'));
 writeExclusive(p,text);console.log('Local publication candidate: '+rel(root,p)+'. Inspect and manually copy to content only after confirming current review and run existing build/tests.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
