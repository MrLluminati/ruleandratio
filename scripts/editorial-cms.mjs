import {createServer} from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync,lstatSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,relative,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stringify} from 'yaml';
import MarkdownIt from 'markdown-it';
import {inventory,buildReport,makeItem,createReview,reviewState,prepare,parseArticle} from './editorial.mjs';
import {importStatute} from './import-statute.mjs';

const assets=dirname(fileURLToPath(import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const error=(m,status=400)=>{throw Object.assign(new Error(m),{status})};
const md=new MarkdownIt({html:false,linkify:false,typographer:false}).disable('image');
const text=v=>typeof v==='string'&&v.trim();
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const own=(o,k)=>Object.hasOwn(o??{},k);
const idOK=id=>typeof id==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
function confined(root,p){
 const absolute=resolve(root,p),r=relative(root,absolute);
 if(isAbsolute(r)||r==='..'||r.startsWith('..'+sep))error('Path outside workspace');
 let cur=root;
 for(const part of r.split(sep).filter(Boolean)){cur=join(cur,part);if(existsSync(cur)&&lstatSync(cur).isSymbolicLink())error('Symlink paths are not permitted')}
 return absolute;
}
function write(root,p,contents,exclusive=false){
 const target=confined(root,p);mkdirSync(dirname(target),{recursive:true});
 if(exclusive){writeFileSync(target,contents,{flag:'wx'});return}
 const tmp=target+'.tmp-'+randomBytes(8).toString('hex');
 try{writeFileSync(tmp,contents,{flag:'wx'});renameSync(tmp,target)}finally{if(existsSync(tmp))rmSync(tmp)}
}
const reviewFile=id=>'.rr-editorial/reviews/'+id+'.json';
const record=(root,id)=>{const p=confined(root,reviewFile(id));return existsSync(p)?json(p):null};
function itemFor(root,id){
 if(!idOK(id))error('Invalid document ID');
 const item=inventory(root).items.find(i=>i.id===id);
 if(!item)error('Document not found',404);
 return item;
}
function mutable(root,id,hash){
 const i=itemFor(root,id);
 if(i.template||!i.draft)error('Only substantive drafts may be edited',409);
 if(i.sha256!==hash)error('Draft changed. Reload before continuing.',409);
 return i;
}
const toRaw=(data,body)=>'---\n'+stringify(data,{lineWidth:0})+'---\n'+body;
function detail(root,i){
 const raw=readFileSync(confined(root,i.path),'utf8'),r=record(root,i.id);
 if(sha(raw)!==i.sha256)error('Document changed. Reload.',409);
 return {item:{...i,body:undefined,data:undefined},raw,metadata:i.data,record:r,state:reviewState(i,r),preview:i.kind==='article'?md.render(i.body):null};
}
function saveDraft(root,i,raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>2_000_000)error('Draft text must be at most 2 MB');
 const next=makeItem(i.path,raw,i.kind);
 if(next.id!==i.id||next.type!==i.type||next.data.draft!==true)error('Cannot change slug, type or draft:true in the CMS');
 for(const k of ['reviewer','reviewedAt','publishedAt'])if(next.data[k]!==undefined&&next.data[k]!==i.data[k])error('Approval metadata belongs in the review record');
 if(next.type==='news'&&next.data.news?.verification==='verified'&&i.data.news?.verification!=='verified')error('News verification belongs in the review workflow');
 if(sha(readFileSync(confined(root,i.path)))!==i.sha256)error('Draft changed. Reload.',409);
 write(root,i.path,raw);
 return detail(root,itemFor(root,i.id));
}
function saveReview(root,i,input,expectedRecordHash){
 const old=record(root,i.id);
 if((old?sha(JSON.stringify(old)):null)!==expectedRecordHash)error('Review record changed. Reload.',409);
 if(old&&reviewState(i,old).status==='stale')error('Review is stale; reset it explicitly first',409);
 const r=createReview(i);
 if(!input||!['in-review','blocked','approved'].includes(input.decision))error('Invalid review decision');
 for(const k of ['reviewer','reviewedAt','note']){if(typeof input[k]!=='string'||input[k].length>10000)error('Invalid review field: '+k);r[k]=input[k]}
 r.decision=input.decision;
 if(r.decision==='approved'&&input.confirmApproval!==true)error('Explicit human approval confirmation required',422);
 if(i.pilot){if(input.pilotHash!==i.pilot.hash)error('Pilot review plan changed. Reload.',409);for(const issue of i.pilot.issues){const note=input.pilotNotes?.[issue.key];if(typeof note!=='string'||note.length>10000)error('Missing or invalid pilot evidence note');r.pilotNotes[issue.key]=note}}
 for(const k of i.requiredChecks){if(typeof input.checks?.[k]!=='boolean')error('Missing checklist field: '+k);r.checks[k]=input.checks[k]}
 for(const s of i.sources){const v=input.sources?.[s.key];if(typeof v?.verified!=='boolean'||typeof v?.note!=='string'||v.note.length>10000)error('Invalid source review: '+s.title);r.sources[s.key]={verified:v.verified,note:v.note}}
 const state=reviewState(i,r);
 if(r.decision==='approved'&&state.status!=='ready')error('Approval incomplete: '+state.missing.join('; '),422);
 write(root,reviewFile(i.id),JSON.stringify(r,null,2)+'\n');
 return detail(root,itemFor(root,i.id));
}
function resetReview(root,i){
 const old=record(root,i.id);
 if(old&&reviewState(i,old).status!=='stale')error('Only stale reviews can be reset',409);
 if(old)write(root,'.rr-editorial/archive/'+i.id+'-'+randomBytes(8).toString('hex')+'.json',JSON.stringify(old,null,2)+'\n',true);
 write(root,reviewFile(i.id),JSON.stringify(createReview(i),null,2)+'\n');
 return detail(root,itemFor(root,i.id));
}
function manifests(root){
 const dir=confined(root,'.rr-sources');if(!existsSync(dir))return [];
 return readdirSync(dir,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).flatMap(e=>{
  const path='.rr-sources/'+e.name+'/manifest.json',p=confined(root,path);if(!existsSync(p))return [];
  try{const m=json(p);return [{path,slug:m.slug,title:m.title}]}catch{return [{path,slug:null,title:'Invalid manifest'}]}
 });
}
function importLocal(root,path){
 const m=manifests(root).find(x=>x.path===path);
 if(!m||!idOK(m.slug))error('Select a valid local manifest');
 const manifest=confined(root,m.path),data=json(manifest);
 for(const s of data.sources??[]){if(typeof s.file!=='string'||isAbsolute(s.file))error('Invalid manifest source path');const file=resolve(dirname(manifest),s.file),r=relative(dirname(manifest),file);if(r==='..'||r.startsWith('..'+sep)||isAbsolute(r))error('Source escapes manifest folder');confined(root,file)}
 confined(root,'.rr-import/'+m.slug);
 const result=importStatute(manifest,confined(root,'.rr-import'));
 return {id:'import-'+m.slug,count:result.draft.provisions.length};
}
function comparison(root,i){
 if(i.kind!=='import')error('Comparison available only for local imported statutes');
 const reportPath=confined(root,join(dirname(i.path),'review.json'));
 if(!existsSync(reportPath))error('Import provenance report missing');
 const report=json(reportPath),m=manifests(root).find(x=>x.slug===i.slug);
 if(!m) return {rows:[],warning:'Matching source manifest is missing; restore original extracted text.'};
 const manifestPath=confined(root,m.path);
 if(sha(readFileSync(manifestPath))!==report.manifestSha256)return {rows:[],warning:'Manifest changed since import; cannot establish original provenance.'};
 const sourceById=new Map((report.sourceDocuments??[]).map(s=>[s.id,s]));
 const manifest=json(manifestPath),originalById=new Map((manifest.sources??[]).map(s=>[s.id,s]));
 const rows=(report.extractions??[]).map(e=>{
  const s=sourceById.get(e.sourceId),original=originalById.get(e.sourceId),version=i.data.provisions?.find(p=>p.slug===e.provision)?.versions?.find(v=>v.id===e.version);
  const row={provision:e.provision,version:e.version,current:version?.text??'',original:'',status:'unavailable',pinpoint:version?.source?.pinpoint??''};
  if(!s||!original||s.file!==original.file||typeof s.file!=='string')return row;
  const file=resolve(dirname(manifestPath),s.file),rel=relative(dirname(manifestPath),file);
  if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))return row;
  try{const bytes=readFileSync(confined(root,file));if(sha(bytes)!==s.sha256){row.status='source-changed';return row}
   row.original=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/\r\n?/g,'\n').split('\n').slice(e.startLine-1,e.endLine).join('\n');
   row.status=sha(row.original)!==e.sha256?'extraction-mismatch':row.original===row.current?'matches-extraction':'draft-text-changed';
  }catch{row.status='unavailable'}return row;
 });
 return {rows,warning:'Comparison is against local extracted text, not authentication of the original PDF or current legal version.'};
}
const relations=['cited','followed','relied-on','distinguished','explained','approved','overruled','partly-overruled','doubted','referred-to-larger-bench'];
function links(root,i,change){
 if(i.kind!=='article')error('Relationships are for articles');
 const {items}=inventory(root),d=structuredClone(i.data);
 if(change.kind==='statute'){
  const refs=d.statuteRefs??[];
  if(change.action==='remove'){if(!Number.isInteger(change.index)||!refs[change.index])error('Invalid relationship index');refs.splice(change.index,1)}
  else if(change.action==='add'){
   const a=items.find(x=>x.kind==='statute'&&!x.draft&&!x.template&&x.slug===change.act);
   if(!a||change.provision&&!a.data.provisions?.some(p=>p.slug===change.provision))error('Select a published statutory target');
   const r={act:a.slug,...(change.provision?{provision:change.provision}:{})};
   if(refs.some(x=>x.act===r.act&&x.provision===r.provision))error('Duplicate relationship');refs.push(r);
  }else error('Invalid relationship action');
  d.statuteRefs=refs;
 }else if(change.kind==='judgment'&&i.type==='judgment'){
  const j=d.judgment;if(!j)error('Missing judgment metadata');const refs=j.treatments??[];
  if(change.action==='remove'){if(!Number.isInteger(change.index)||!refs[change.index])error('Invalid relationship index');refs.splice(change.index,1)}
  else if(change.action==='add'){
   const t=items.find(x=>x.kind==='article'&&x.type==='judgment'&&!x.draft&&x.slug===change.targetSlug);
   if(!t||t.slug===i.slug||!t.data.judgment||String(t.data.judgment.decisionDate)>String(j.decisionDate))error('Select a published earlier judgment');
   if(!relations.includes(change.relation)||!text(change.issue)||!text(change.pinpoint)||!text(change.explanation))error('Relation, issue, pinpoint and explanation required');
   if(refs.some(r=>r.targetSlug===t.slug&&r.relation===change.relation&&r.issue===change.issue&&r.pinpoint===change.pinpoint))error('Duplicate relationship');
   refs.push({relation:change.relation,targetCase:t.data.judgment.caseName,targetSlug:t.slug,issue:change.issue,pinpoint:change.pinpoint,explanation:change.explanation});
  }else error('Invalid relationship action');j.treatments=refs;
 }else error('Invalid relationship type');
 return saveDraft(root,i,toRaw(d,i.body));
}
function reviewHash(d){return {...d,recordHash:d.record?sha(JSON.stringify(d.record)):null}}
async function readBody(req){
 if(req.headers['content-type']!=='application/json')error('JSON content type required',415);
 const parts=[];let n=0;for await(const c of req){n+=c.length;if(n>2_500_000)error('Request too large',413);parts.push(c)}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{error('Invalid JSON')}
}
export function createCMS(root=process.cwd(),port=4317){
 root=resolve(root);const token=randomBytes(32).toString('hex');
 const server=createServer(async(req,res)=>{
  const send=(status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'X-Frame-Options':'DENY'});res.end(typeof data==='string'?data:JSON.stringify(data))};
  try{
   const address=server.address(),host='127.0.0.1:'+address.port,origin='http://'+host;
   if(req.headers.host!==host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')error('Local origin required',403);
   const u=new URL(req.url,origin);
   if(req.method==='GET'&&u.pathname==='/')return send(200,readFileSync(join(assets,'editorial-cms.html'),'utf8').replace('__SESSION_TOKEN__',token),'text/html; charset=utf-8');
   if(req.method==='GET'&&['/cms.js','/cms.css'].includes(u.pathname))return send(200,readFileSync(join(assets,'editorial-cms'+u.pathname.slice(4)),'utf8'),u.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
   if(req.method!=='POST'||u.pathname!=='/api')error('Not found',404);
   if(req.headers['x-rr-session']!==token||req.headers.origin!==origin)error('Session or origin rejected',403);
   const b=await readBody(req);if(!b||typeof b!=='object'||Array.isArray(b))error('Invalid request');
   if(b.action==='queue'){
    const report=buildReport(root),{items}=inventory(root);
    return send(200,{...report,manifests:manifests(root),targets:{statutes:items.filter(i=>i.kind==='statute'&&!i.draft).map(i=>({slug:i.slug,title:i.title,provisions:i.data.provisions?.map(p=>({slug:p.slug,heading:p.heading}))??[]})),judgments:items.filter(i=>i.type==='judgment'&&!i.draft).map(i=>({slug:i.slug,title:i.title}))}});
   }
   if(b.action==='detail')return send(200,reviewHash(detail(root,itemFor(root,b.id))));
   if(b.action==='preview')return send(200,{html:md.render(parseArticle(b.raw).body)});
   if(b.action==='import')return send(200,importLocal(root,b.path));
   if(b.action==='bulk'){
    if(!Array.isArray(b.ids)||b.ids.length>500||b.ids.some(x=>!idOK(x)))error('Invalid selection');
    let created=0,skipped=0;
    const selected=new Set(b.ids);
    for(const i of inventory(root).items.filter(i=>selected.has(i.id))){
     if(i.template||!i.draft||record(root,i.id)){skipped++;continue}
     write(root,reviewFile(i.id),JSON.stringify(createReview(i),null,2)+'\n',true);created++;
    }return send(200,{created,skipped});
   }
   const i=mutable(root,b.id,b.hash);
   if(b.action==='save')return send(200,reviewHash(saveDraft(root,i,b.raw)));
   if(b.action==='review')return send(200,reviewHash(saveReview(root,i,b.record,b.recordHash)));
   if(b.action==='reset')return send(200,reviewHash(resetReview(root,i)));
   if(b.action==='links')return send(200,reviewHash(links(root,i,b.change)));
   if(b.action==='compare')return send(200,comparison(root,i));
   if(b.action==='prepare'){
    const r=record(root,i.id);
    if(!r||sha(JSON.stringify(r))!==b.recordHash)error('Review record changed. Reload.',409);
    if(b.confirmPrepare!==true)error('Explicit candidate confirmation required',422);
    const candidate=prepare(i,r,b.date),path='.rr-editorial/prepared/'+i.id+'-'+i.sha256.slice(0,12)+(i.kind==='article'?'.md':'.json');
    write(root,path,candidate,true);return send(200,{path,sha256:sha(candidate),draftSha256:i.sha256,recordHash:b.recordHash,destination:i.kind==='import'?'src/content/statutes/'+i.slug+'.json':i.path,note:'Candidate only; manually inspect, copy and run build and publishing tests.'});
   }
   error('Unknown action');
  }catch(e){send(e.status??(e.code==='EEXIST'?409:400),{error:e.code==='EEXIST'?'File already exists; archive it manually before retrying.':e.message})}
 });
 return {server,start:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port))})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.argv[2]??4317);if(!Number.isInteger(port)||port<1024||port>65535){console.error('Invalid port');process.exitCode=1}else createCMS(process.cwd(),port).start().then(u=>console.log('Local editorial CMS: '+u+' — Ctrl+C to stop. No automatic publication.')).catch(e=>{console.error(e.message);process.exitCode=1});
}
