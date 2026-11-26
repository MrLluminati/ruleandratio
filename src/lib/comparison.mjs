export const relationshipLabels={corresponding:'Corresponding — verify text',changed:'Material change',merged:'Consolidated provisions',split:'Subdivided provisions',new:'New standalone provision',omitted:'No direct counterpart'};
export function validateComparison(data){
 const ids=new Set();const valid=/^[0-9]+[A-Z]?(?:\([0-9a-z]+\))*$/;
 for(const r of data.entries){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||ids.has(r.slug))throw Error('Invalid or duplicate comparison slug');ids.add(r.slug);
  if(!Object.hasOwn(relationshipLabels,r.relation)||!r.title?.trim()||!r.category?.trim()||!r.analysis?.trim())throw Error('Incomplete comparison');
  for(const side of [r.oldSections,r.newSections])if(!Array.isArray(side)||side.some(s=>!valid.test(s))||new Set(side).size!==side.length)throw Error('Invalid section references');
  if(r.relation==='new'?r.oldSections.length||!r.newSections.length:r.relation==='omitted'?r.newSections.length||!r.oldSections.length:!r.oldSections.length||!r.newSections.length)throw Error('Invalid relationship sides');
  if(!['preview','reviewed'].includes(r.status)||r.status==='reviewed'&&(!r.reviewer?.trim()||!r.reviewedAt))throw Error('Review metadata required');
 }
 for(const s of Object.values(data.sources))if(!/^https:\/\//.test(s))throw Error('Invalid source link');
 return data.entries;
}
export function sectionMatches(ref,query){return ref.toUpperCase()===query.toUpperCase()||ref.toUpperCase().startsWith(query.toUpperCase()+'(')}
export function comparisonMatches(r,query,side='both'){
 const q=query.trim().toUpperCase().replace(/^(IPC|BNS)\s*/,'').replace(/^(SECTION|SEC\.?|S\.)\s*/,'').replace(/\s+/g,'');
 if(!q)return true;
 if(/^[0-9]+[A-Z]?(?:\([0-9A-Z]+\))*$/.test(q))return (side!=='new'&&r.oldSections.some(s=>sectionMatches(s,q)))||(side!=='old'&&r.newSections.some(s=>sectionMatches(s,q)));
 return [r.title,r.category,r.analysis].join(' ').toLowerCase().includes(query.trim().toLowerCase());
}
