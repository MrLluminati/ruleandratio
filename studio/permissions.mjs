// Pure policy only. No HTTP authentication, endpoint, billing integration or DB access.
// Call exclusively with verified, server-loaded identity and assignment/entitlement data.
// Never pass a browser-supplied actor, role, assignment, review or clock.
const elevated = a => a.role === 'owner' || a.role === 'admin';
const has = (list, value) => Array.isArray(list) && list.includes(value);
const sha = s => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
export function canMember(actor,action,context={}){
 if(!actor || actor.kind!=='member' || actor.status!=='active' || typeof actor.id!=='string'||!actor.id)return false;
 switch(action){
  case 'profile:read':case 'profile:update':case 'bookmark:manage':
   return context.memberId===actor.id;
  case 'premium:read':
   return Number.isSafeInteger(context.now)&&Array.isArray(context.entitlements)&&context.entitlements.some(e=>e.memberId===actor.id&&e.capability==='premium-research'&&e.revokedAt==null&&Number.isSafeInteger(e.validFrom)&&Number.isSafeInteger(e.validUntil)&&e.validFrom<=context.now&&context.now<e.validUntil);
  default:return false;
 }
}
export function canStaff(actor,action,context={}){
 if(!actor||actor.kind!=='staff'||actor.status!=='active'||typeof actor.id!=='string'||!actor.id||!['owner','admin','author','reviewer'].includes(actor.role))return false;
 const doc=context.document;
 const assigned=has(context.assignedCapabilities,'edit')||has(context.assignedCapabilities,'review');
 switch(action){
  case 'studio:read':return true;
  case 'staff:manage':return actor.role==='owner'; // only owner grants or revokes staff access
  case 'member:support':return elevated(actor);
  case 'document:read':return !!doc&&(elevated(actor)||assigned);
  case 'document:create':return elevated(actor); // author creation is through a pre-assigned draft
  case 'document:edit':
   return !!doc&&['draft','in-review'].includes(doc.status)&&(elevated(actor)||actor.role==='author'&&has(context.assignedCapabilities,'edit'));
  case 'document:review':
   return !!doc&&doc.status==='in-review'&&(elevated(actor)||actor.role==='reviewer'&&has(context.assignedCapabilities,'review'));
  case 'publication:request':{
   const r=context.review;
   return elevated(actor)&&!!doc&&doc.status==='approved'&&sha(doc.currentRevisionHash)&&sha(context.currentReviewPlanHash)&&r?.decision==='approved'&&r.documentId===doc.id&&r.revisionHash===doc.currentRevisionHash&&r.reviewPlanHash===context.currentReviewPlanHash&&context.reviewStillValid===true;
  }
  default:return false;
 }
}
