export const relationshipLabels={corresponding:'Corresponding — verify text',changed:'Material change',merged:'Consolidated provisions',split:'Subdivided provisions',new:'New standalone provision',omitted:'No direct counterpart'};
export function validateComparison(data){
 const ids=new Set();const valid=/^[0-9]+[A-Z]?(?:\([0-9a-z]+\))*$/;
 for(const r of data.entries){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)||ids.has(r.slug))throw Error('Invalid or duplicate comparison slug');ids.add(r.slug);
  if(!Object.hasOwn(relationshipLabels,r.relation)||!r.title?.trim()||!r.category?.trim()||!r.analysis?.trim())throw Error('Incomplete comparison');
  for(const side of [r.oldSections,r.newSections])if(!Array.isArray(side)||side.some(s=>!valid.test(s))||new Set(side).size!==side.length)throw Error('Invalid section references');
  if(r.relation==='new'?r.oldSections.length||!r.newSections.length:r.relation==='omitted'?r.newSections.length||!r.oldSections.length:!r.oldSections.length||!r.newSections.length)throw Error('Invalid relationship sides');
  if(!Array.isArray(r.pairs)||r.pairs.length===0||r.pairs.some(p=>p.old===null&&p.new===null||p.old!==null&&!r.oldSections.includes(p.old)||p.new!==null&&!r.newSections.includes(p.new)))throw Error('Invalid subsection correspondence');
  if(r.oldSections.some(s=>!r.pairs.some(p=>p.old===s))||r.newSections.some(s=>!r.pairs.some(p=>p.new===s)))throw Error('Incomplete subsection correspondence');
  if(!['preview','reviewed'].includes(r.status)||r.status==='reviewed'&&(!r.reviewer?.trim()||!r.reviewedAt))throw Error('Review metadata required');
 }
 for(const s of Object.values(data.sources))if(!/^https:\/\//.test(s))throw Error('Invalid source link');
 return data.entries;
}
export function sectionMatches(ref,query){return ref.toUpperCase()===query.toUpperCase()||ref.toUpperCase().startsWith(query.toUpperCase()+'(')}
export function comparisonMatches(r,query,side='both',codes=['IPC','BNS']){
 const prefixPattern=new RegExp('^('+codes.join('|')+')(?=\\s|\\d)','i');
 const prefix=query.trim().match(prefixPattern)?.[1]?.toUpperCase();
 if(prefix)side=prefix===codes[0].toUpperCase()?'old':'new';
 const q=query.trim().toUpperCase().replace(prefixPattern,'').replace(/^(SECTION|SEC\.?|S\.)\s*/,'').replace(/\s+/g,'');
 if(!q)return true;
 if(/^[0-9]+[A-Z]?(?:\([0-9A-Z]+\))*$/.test(q))return (side!=='new'&&r.oldSections.some(s=>sectionMatches(s,q)))||(side!=='old'&&r.newSections.some(s=>sectionMatches(s,q)));
 return [r.title,r.category,r.analysis].join(' ').toLowerCase().includes(query.trim().toLowerCase());
}
