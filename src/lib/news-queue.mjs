import {validDay,validateLead,validateNewsRegistry} from './news.mjs';
const DAY=86400000;
const textKey=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const age=(date,asOf)=>(Date.parse(asOf)-Date.parse(date))/DAY;
export function canonicalLeadUrl(value){
 const u=new URL(value);
 // Only remove well-known marketing parameters. Preserve document identifiers, query order and fragments.
 for(const k of [...u.searchParams.keys()])if(/^utm_(source|medium|campaign|term|content|id)$/i.test(k)||['fbclid','gclid'].includes(k.toLowerCase()))u.searchParams.delete(k);
 return u.href;
}
export function buildEditorialQueue(leads,registry,asOf){
 if(!validDay(asOf))throw Error('Invalid queue date');
 validateNewsRegistry(registry);
 const ids=new Set(),groups=new Map();
 for(const raw of leads){
  const l=validateLead(raw,registry,asOf);
  if(ids.has(l.id))throw Error('Duplicate lead ID: '+l.id);ids.add(l.id);
  if(l.publicationAllowed===true||l.stage&&l.stage!=='verification-required')throw Error('Queue accepts unverified intake records only');
  const key=JSON.stringify([canonicalLeadUrl(l.url),l.eventDate,l.kind]);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(l);
 }
 const items=[...groups.values()].map(list=>{
  list.sort((a,b)=>a.id.localeCompare(b.id));
  const daysOld=age(list[0].eventDate,asOf);
  const freshness=daysOld<=2?3:daysOld<=7?2:daysOld<=30?1:0;
  const primaryLead=list.some(l=>l.sourceKind==='primary');
  const priority=Math.max(...list.map(l=>({urgent:4,high:2,normal:0}[l.editorPriority??'normal'])));
  const score=freshness+(primaryLead?2:0)+priority;
  return {id:list[0].id,title:list[0].title,eventDate:list[0].eventDate,kind:list[0].kind,leadIds:list.map(l=>l.id),leads:list.map(l=>({id:l.id,title:l.title,sourceId:l.sourceId,sourceKind:l.sourceKind,url:l.url,authority:l.authority??'',identifier:l.identifier??'',editorPriority:l.editorPriority??'normal',priorityReason:l.priorityReason??''})),areas:[...new Set(list.flatMap(l=>l.areas))].sort(),daysOld,primaryLead,score,scoreBreakdown:{freshness,primaryDiscovery:primaryLead?2:0,editorPriority:priority},stage:'verification-required',publicationAllowed:false};
 });
 items.sort((a,b)=>b.score-a.score||b.eventDate.localeCompare(a.eventDate)||a.id.localeCompare(b.id));
 const candidates=[];
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];
  const reference=a.leads.some(x=>b.leads.some(y=>textKey(x.authority)&&textKey(x.identifier)&&textKey(x.authority)===textKey(y.authority)&&textKey(x.identifier)===textKey(y.identifier)));
  const sameEvent=a.eventDate===b.eventDate&&a.kind===b.kind;
  const headline=sameEvent&&a.leads.some(x=>b.leads.some(y=>textKey(x.title)===textKey(y.title)));
  if(reference||headline)candidates.push({a:a.id,b:b.id,reason:reference?(sameEvent?'matching authority/reference and development date':'matching reference; potentially separate developments'):'matching normalized headline and development date',action:'manual-review-only'});
 }
 return {asOf,totalLeads:leads.length,distinctDocumentGroups:items.length,groupedAdditionalLeads:leads.length-items.length,items,candidates,publicationAllowed:false};
}
export function sourceCheckSummary(checks,registry,asOf){
 if(!validDay(asOf))throw Error('Invalid monitoring date');
 validateNewsRegistry(registry);
 const known=new Set(registry.map(s=>s.id)),seen=new Set();
 for(const c of checks){
  if(!known.has(c.sourceId)||!validDay(c.checkedOn)||c.checkedOn>asOf||!['checked','unavailable','not-authorized'].includes(c.outcome)||typeof c.notes!=='string')throw Error('Invalid source check');
  const key=c.sourceId+'|'+c.checkedOn;
  if(seen.has(key))throw Error('Duplicate source check for date: '+key);seen.add(key);
 }
 return registry.map(s=>{
  const latest=checks.filter(c=>c.sourceId===s.id).sort((a,b)=>b.checkedOn.localeCompare(a.checkedOn))[0];
  const cadenceDays=s.kind==='primary'?1:7;
  const elapsed=latest?age(latest.checkedOn,asOf):null;
  return {sourceId:s.id,name:s.name,kind:s.kind,url:s.url,cadenceDays,lastChecked:latest?.checkedOn??null,lastOutcome:latest?.outcome??null,daysSinceCheck:elapsed,due:!latest||elapsed>=cadenceDays||latest.outcome==='unavailable',note:latest?.outcome==='not-authorized'?'Do not access without authorization.':latest?.outcome==='unavailable'?'Manual follow-up only; no automatic retry.':''};
 });
}
