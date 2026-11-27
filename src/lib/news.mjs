export const newsKinds={
  "judicial-decision": "Judgment or final order",
  "interim-order": "Interim order",
  "court-proceeding": "Court proceeding / hearing",
  "legislative-bill": "Bill or legislative proposal",
  "enactment": "Enactment",
  "notification": "Gazette / notification",
  "institutional-update": "Institutional update",
  "digest": "Legal digest"
};
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function validDay(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s}
export function validateNewsRegistry(registry){const ids=new Set();for(const s of registry){if(!slug.test(s.id)||ids.has(s.id)||!s.name?.trim()||!s.scope?.trim()||!['primary','secondary'].includes(s.kind)||!/^https:\/\//.test(s.url)||s.access!=='manual'||s.automatedAccess!==false)throw Error('Invalid news source registry record');ids.add(s.id)}return registry}
export function validateLead(lead,registry,today=new Date().toISOString().slice(0,10)){
 const known=validateNewsRegistry(registry).find(s=>s.id===lead.sourceId);
 if(!known||!slug.test(lead.id)||!lead.title?.trim()||!Object.hasOwn(newsKinds,lead.kind)||!validDay(lead.eventDate)||!validDay(lead.capturedOn)||lead.eventDate>lead.capturedOn||lead.capturedOn>today)throw Error('Invalid lead identity, dates or source');
 let url;try{url=new URL(lead.url)}catch{throw Error('Document-specific URL required')}
 if(url.protocol!=='https:'||url.username||url.password||(!url.pathname.replaceAll('/','')&&!url.search))throw Error('Document-specific HTTPS URL required');
 if(lead.status!=='unverified'||typeof lead.notes!=='string'||!Array.isArray(lead.areas)||!lead.areas.length||lead.areas.some(a=>!slug.test(a)))throw Error('Leads must be unverified and identify subjects');
 if(lead.authority!==undefined&&(typeof lead.authority!=='string'||!lead.authority.trim())||lead.identifier!==undefined&&(typeof lead.identifier!=='string'||!lead.identifier.trim()))throw Error('Optional authority and identifier must be nonempty text');
 if(lead.editorPriority!==undefined&&!['normal','high','urgent'].includes(lead.editorPriority))throw Error('Invalid editorial priority');
 if(['high','urgent'].includes(lead.editorPriority)&& (typeof lead.priorityReason!=='string'||!lead.priorityReason.trim()))throw Error('Elevated priority requires editorial rationale');
 return {...lead,sourceName:known.name,sourceKind:known.kind};
}
