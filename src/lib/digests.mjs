import {validDay} from './news.mjs';
const day=86400000;
const iso=d=>d instanceof Date?d.toISOString().slice(0,10):d;
export function digestPeriod(frequency,start,end){
 start=iso(start);end=iso(end);
 if(!validDay(start)||!validDay(end))throw Error('Invalid digest coverage dates');
 const a=new Date(start+'T00:00:00Z'),b=new Date(end+'T00:00:00Z');
 if(frequency==='daily'&&start===end)return {frequency,start,end};
 if(frequency==='weekly'&&a.getUTCDay()===1&&b-a===6*day)return {frequency,start,end};
 throw Error('Daily digest covers one day; weekly digest covers Monday through Sunday.');
}
// Uses already schema-validated, non-draft Astro article entries. No network access.
export function digestCandidates(entries,{frequency,start,end,asOf}){
 const period=digestPeriod(frequency,start,end);asOf=iso(asOf);
 if(!validDay(asOf)||period.end>asOf)throw Error('Digest period has not ended as of the selected date.');
 return entries.filter(e=>{const d=e.data,n=d.news;
 return d.type==='news'&&d.draft===false&&d.slug&&d.reviewer&&d.reviewedAt&&d.publishedAt&&n?.verification==='verified'&&n.kind!=='digest'&&iso(n.eventDate)>=period.start&&iso(n.eventDate)<=period.end&&iso(d.publishedAt)<=asOf&&iso(d.reviewedAt)<=asOf&&iso(d.modifiedAt??d.publishedAt)<=asOf&&d.sources?.some(s=>s.kind==='primary'&&s.url===n.primaryUrl&&s.pinpoint);
 }).sort((a,b)=>iso(a.data.news.eventDate).localeCompare(iso(b.data.news.eventDate))||a.data.slug.localeCompare(b.data.slug));
}
export function resolveDigest(entry,entries){
 const d=entry.data,g=d.news?.digest;
 if(!g)throw Error('Digest metadata required');
 const period=digestPeriod(g.frequency,g.start,g.end);
 const asOf=iso(d.reviewedAt);
 if(!validDay(asOf)||period.end>asOf||period.end>iso(d.publishedAt))throw Error('Digest coverage must end by review and publication');
 const allowed=new Map(digestCandidates(entries,{...period,asOf}).map(e=>[e.data.slug,e]));
 const seen=new Set(),documents=new Set(),items=[];
 for(const slug of g.reportSlugs){
  if(seen.has(slug))throw Error('Duplicate digest report: '+slug);seen.add(slug);
  const report=allowed.get(slug);
  if(!report)throw Error('Digest report is not an eligible reviewed publication: '+slug);
  const n=report.data.news,key=JSON.stringify([n.primaryUrl,iso(n.eventDate),n.kind]);
  if(documents.has(key))throw Error('Duplicate primary document in digest: '+slug);documents.add(key);
  if(!d.sources.some(s=>s.kind==='primary'&&s.url===n.primaryUrl&&s.pinpoint))throw Error('Missing primary source for digest report: '+slug);
  items.push(report);
 }
 if(!items.length)throw Error('A digest cannot be empty');
 if(iso(d.news.eventDate)!==items.map(e=>iso(e.data.news.eventDate)).sort().at(-1))throw Error('Digest event date must equal latest included event');
 return items;
}
