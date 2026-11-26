import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw new Error(m)};
const nonempty=(v,label)=>typeof v==='string'&&v.trim()?v:fail('Missing '+label);
const slug=(v,label)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nonempty(v,label))?v:fail('Invalid '+label);
const list=(v,label)=>Array.isArray(v)?v:fail('Expected array: '+label);
const unique=(values,label)=>{if(new Set(values).size!==values.length)fail('Duplicate '+label)};
const date=v=>{if(v===undefined)return undefined; if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('Invalid date: '+v);const d=new Date(v+'T00:00:00Z');if(isNaN(d.getTime())||d.toISOString().slice(0,10)!==v)fail('Invalid date: '+v);return v};
const safeUrl=v=>{const u=new URL(nonempty(v,'source URL'));if(u.protocol!=='https:'||u.username||u.password)fail('Source URL must be HTTPS without credentials');return u.href};
const officialHost=h=>['indiacode.nic.in','indiacode.gov.in','egazette.nic.in','egazette.gov.in','legislative.gov.in'].some(d=>h===d||h.endsWith('.'+d));
const taxonomy=readFileSync(new URL('../src/data/areas.ts',import.meta.url),'utf8');
const knownAreas=new Set([...taxonomy.matchAll(/slug:'([^']+)'/g)].map(m=>m[1]));
export function importStatute(manifestPath,outputRoot='.rr-import'){
 const file=resolve(manifestPath),m=JSON.parse(readFileSync(file,'utf8')),dir=dirname(file);
 if(m.draft!==undefined&&m.draft!==true)fail('Importer accepts drafts only');
 for(const k of ['reviewer','reviewedAt','publishedAt','status','coverage'])if(m[k]!==undefined)fail('Editorial field not accepted by importer: '+k);
 const id=slug(m.slug,'Act slug'),title=nonempty(m.title,'Act title');
 const areas=list(m.areas,'areas').map(a=>{if(!knownAreas.has(a))fail('Unknown area: '+a);return a});if(!areas.length)fail('At least one area required');unique(areas,'area');
 const sources=new Map(),warnings=[];
 for(const s of list(m.sources,'sources')){
  const sid=slug(s.id,'source ID');if(sources.has(sid))fail('Duplicate source: '+sid);
  const url=safeUrl(s.url);if(!officialHost(new URL(url).hostname))warnings.push('Manually authenticate non-listed source host: '+url);
  const local=nonempty(s.file,'source text file');if(isAbsolute(local)||relative(dir,resolve(dir,local)).startsWith('..'))fail('Source text must be inside manifest directory');
  const bytes=readFileSync(resolve(dir,local));if(!bytes.length)fail('Empty source file');
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const lines=decoded.replace(/\r\n?/g,'\n').split('\n');
  if(decoded.includes('\uFFFD')||decoded.includes('\u0000'))fail('Invalid extracted source text');
  const capturedAt=date(s.capturedAt);if(!capturedAt||capturedAt>new Date().toISOString().slice(0,10))fail('Actual source capture date required');
  sources.set(sid,{title:nonempty(s.title,'source title'),url,lines,sha256:sha(bytes),capturedAt,file:local});
 }
 const ref=(id,pinpoint)=>{const s=sources.get(id);if(!s)fail('Unknown source: '+id);return {title:s.title,url:s.url,...(pinpoint?{pinpoint:nonempty(pinpoint,'pinpoint')}:{})}};
 const chapters=list(m.chapters??[],'chapters').map(c=>({slug:slug(c.slug,'chapter slug'),label:nonempty(c.label,'chapter label'),title:nonempty(c.title,'chapter title')}));unique(chapters.map(c=>c.slug),'chapter');
 const used=new Map(),ledger=[];
 const provisions=list(m.provisions,'provisions').map(p=>{
  const pid=slug(p.slug,'provision slug');if(!['section','article','rule','schedule','order','regulation','other'].includes(p.kind))fail('Unknown provision kind');
  if(p.chapter&&!chapters.some(c=>c.slug===p.chapter))fail('Unknown chapter: '+p.chapter);
  const versions=list(p.versions,'versions').map(v=>{
   const s=sources.get(v.sourceId);if(!s)fail('Unknown source: '+v.sourceId);
   const {startLine,endLine}=v;
   if(!Number.isInteger(startLine)||!Number.isInteger(endLine)||startLine<1||endLine<startLine||endLine>s.lines.length)fail('Invalid source line range for '+pid);
   const intervals=used.get(v.sourceId)??[];
   if(intervals.some(i=>startLine<=i.end&&endLine>=i.start))fail('Overlapping extraction ranges in '+v.sourceId);
   intervals.push({start:startLine,end:endLine});used.set(v.sourceId,intervals);
   const text=s.lines.slice(startLine-1,endLine).join('\n');
   if(!text.trim())fail('Empty provision text: '+pid);
   const id=slug(v.id,'version ID'),effectiveFrom=date(v.effectiveFrom),effectiveUntil=date(v.effectiveUntil);
   if(effectiveUntil&&(!effectiveFrom||effectiveUntil<=effectiveFrom))fail('Invalid effective interval');
   const source=ref(v.sourceId,nonempty(v.pinpoint,'official source pinpoint'));
   ledger.push({provision:pid,version:id,sourceId:v.sourceId,startLine,endLine,sha256:sha(text)});
   return {id,text,source,...(effectiveFrom?{effectiveFrom}:{}),...(effectiveUntil?{effectiveUntil}:{}),amendmentIds:list(v.amendmentIds??[],'amendment IDs').map(a=>slug(a,'amendment ID'))};
  });
  if(!versions.length)fail('No versions: '+pid);unique(versions.map(v=>v.id),'version in '+pid);
  const dated=versions.filter(v=>v.effectiveFrom).sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
  for(let i=1;i<dated.length;i++)if(!dated[i-1].effectiveUntil||dated[i-1].effectiveUntil>dated[i].effectiveFrom)fail('Overlapping effective intervals: '+pid);
  return {slug:pid,number:nonempty(p.number,'provision number'),kind:p.kind,heading:nonempty(p.heading,'provision heading'),...(p.chapter?{chapter:p.chapter}:{}),versions};
 });
 if(!provisions.length)fail('No provisions');unique(provisions.map(p=>p.slug),'provision slug');unique(provisions.map(p=>p.kind+':'+p.number),'provision number');
 const amendments=list(m.amendments??[],'amendments').map(a=>({slug:slug(a.slug,'amendment slug'),title:nonempty(a.title,'amendment title'),description:nonempty(a.description,'amendment description'),source:ref(a.sourceId,nonempty(a.pinpoint,'amendment pinpoint')),...(a.effectiveDate?{effectiveDate:date(a.effectiveDate)}:{}),affectedProvisions:list(a.affectedProvisions??[],'affected provisions').map(p=>slug(p,'affected provision'))}));
 unique(amendments.map(a=>a.slug),'amendment slug');
 for(const a of amendments)for(const p of a.affectedProvisions)if(!provisions.some(x=>x.slug===p))fail('Unknown affected provision: '+p);
 for(const p of provisions)for(const v of p.versions)for(const a of v.amendmentIds)if(!amendments.some(x=>x.slug===a&&x.affectedProvisions.includes(p.slug)))fail('Unresolved amendment link: '+a);
 const draft={slug:id,title,jurisdiction:nonempty(m.jurisdiction,'jurisdiction'),areas,source:ref(m.mainSourceId,m.mainPinpoint),draft:true,coverage:'selected-provisions',chapters,provisions,amendments};
 if(m.shortTitle!==undefined)draft.shortTitle=nonempty(m.shortTitle,'short title');
 if(m.actNumber!==undefined)draft.actNumber=nonempty(m.actNumber,'Act number');
 if(m.year!==undefined){if(!Number.isInteger(m.year)||m.year<1)fail('Invalid Act year');draft.year=m.year}
 const root=resolve(outputRoot),out=join(root,id);
 const siteContent=resolve('src/content');
 if(root===siteContent||root.startsWith(siteContent+ (process.platform==='win32'?'\\':'/')))fail('Import output must be outside public content directories');
 if(existsSync(out))fail('Output exists; refusing to overwrite: '+out);
 const report={act:id,state:'awaiting-human-review',manifestSha256:sha(readFileSync(file)),sourceDocuments:[...sources].map(([id,{lines,...s}])=>({id,...s,lineCount:lines.length})),extractions:ledger,warnings,checksRequired:['Authenticate official source and capture date','Compare each extraction and heading with the source document','Verify commencement, amendments, repeal and savings','Confirm coverage and reproduction permissions','Record actual reviewer and review date before publication']};
 mkdirSync(root,{recursive:true});mkdirSync(out);
 writeFileSync(join(out,'draft.json'),JSON.stringify(draft,null,2)+'\n',{flag:'wx'});
 writeFileSync(join(out,'review.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return {out,draft,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{if(process.argv.length!==3)fail('Usage: npm run import:statute -- <manifest.json>');const result=importStatute(process.argv[2]);console.log('Draft only: '+result.out+' ('+result.draft.provisions.length+' provisions). Human review required.');}
 catch(e){console.error(e.message);process.exitCode=1}
}
