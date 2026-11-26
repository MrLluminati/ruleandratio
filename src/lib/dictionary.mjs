export function validateDictionary(entries){
 const keys=new Set();
 for(const e of entries){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.slug)||keys.has(e.slug))throw new Error('Invalid or duplicate dictionary slug: '+e.slug);
  keys.add(e.slug);
  for(const k of ['term','category','translation','meaning','example','caution'])if(typeof e[k]!=='string'||!e[k].trim())throw new Error('Missing '+k+' for '+e.slug);
  if(!['preview','reviewed'].includes(e.status))throw new Error('Invalid review status');
  if(!Array.isArray(e.sources)||!e.sources.length||e.sources.some(s=>!s.title?.trim()||!s.pinpoint?.trim()||!/^https?:\/\//.test(s.url)))throw new Error('Missing source metadata: '+e.slug);
  if(e.status==='reviewed'&&(!e.reviewer?.trim()||!e.reviewedAt||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e.reviewedAt)||e.reviewedAt>new Date().toISOString().slice(0,10)))throw new Error('Reviewed entry requires genuine reviewer and date.');
 }
 for(const e of entries)for(const r of e.related??[])if(r===e.slug||!keys.has(r))throw new Error('Invalid related dictionary entry: '+r);
 return [...entries].sort((a,b)=>a.term.localeCompare(b.term,'en'));
}
export function normalizeDictionaryQuery(text){return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
export function dictionarySearchText(e){return normalizeDictionaryQuery([e.term,...(e.aliases??[]),e.category,e.translation,e.meaning].join(' '))}
