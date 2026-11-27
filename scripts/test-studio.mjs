import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {canMember,canStaff} from '../studio/permissions.mjs';
const member={id:'m',kind:'member',status:'active',role:'owner'};
const actor=(role,status='active')=>({id:'staff-'+role,kind:'staff',role,status});
test('public membership does not grant editorial authority, including forged-looking member role',()=>{
 assert.equal(canStaff(member,'studio:read'),false);
 assert.equal(canStaff(member,'publication:request'),false);
 assert.equal(canMember(member,'profile:update',{memberId:'other'}),false);
 assert.equal(canMember(member,'profile:update',{memberId:'m'}),true);
 assert.equal(canMember(actor('owner'),'profile:update',{memberId:'staff-owner'}),false);
 assert.equal(canMember({...member,status:'suspended'},'profile:read',{memberId:'m'}),false);
});
test('paid entitlement requires own active grant and excludes expired, future and revoked grants',()=>{
 const grant={memberId:'m',capability:'premium-research',validFrom:10,validUntil:20,revokedAt:null};
 const can=(entitlements,now)=>canMember(member,'premium:read',{entitlements,now});
 assert.equal(can([grant],10),true);
 assert.equal(can([grant],20),false);
 assert.equal(can([grant],9),false);
 assert.equal(can([{...grant,revokedAt:15}],16),false);
 assert.equal(can([{...grant,memberId:'other'}],15),false);
});
test('staff scope and owner-only permissions',()=>{
 const document={id:'d',status:'draft'};
 assert.equal(canStaff(actor('owner','disabled'),'studio:read'),false);
 assert.equal(canStaff(actor('admin'),'staff:manage'),false);
 assert.equal(canStaff(actor('owner'),'staff:manage'),true);
 assert.equal(canStaff(actor('author'),'document:edit',{document}),false);
 assert.equal(canStaff(actor('author'),'document:edit',{document,assignedCapabilities:['edit']}),true);
 assert.equal(canStaff(actor('reviewer'),'document:edit',{document,assignedCapabilities:['edit']}),false);
 assert.equal(canStaff(actor('reviewer'),'document:review',{document:{...document,status:'in-review'},assignedCapabilities:['review']}),true);
 assert.equal(canStaff(actor('admin'),'document:edit',{document:{...document,status:'approved'}}),false);
});
test('publication requires current revision, plan and validated approval',()=>{
 const document={id:'d',status:'approved',currentRevisionHash:'a'.repeat(64)};
 const currentReviewPlanHash='b'.repeat(64);
 const review={decision:'approved',documentId:'d',revisionHash:document.currentRevisionHash,reviewPlanHash:currentReviewPlanHash};
 const context={document,currentReviewPlanHash,review,reviewStillValid:true};
 assert.equal(canStaff(actor('owner'),'publication:request',context),true);
 assert.equal(canStaff(actor('reviewer'),'publication:request',context),false);
 assert.equal(canStaff(actor('admin'),'publication:request',{...context,reviewStillValid:false}),false);
 assert.equal(canStaff(actor('admin'),'publication:request',{...context,currentReviewPlanHash:'c'.repeat(64)}),false);
 assert.equal(canStaff(actor('admin'),'publication:request',{...context,review:{...review,documentId:'other'}}),false);
 assert.equal(canStaff(actor('admin'),'publication:request',{...context,document:{...document,currentRevisionHash:'d'.repeat(64)}}),false);
});
test('schema creates separate staff and membership identities, enforces uniqueness and expiry',()=>{
 const db=new DatabaseSync(':memory:');
 try {
  db.exec(readFileSync(new URL('../studio/migrations/0001_identity_and_editorial.sql',import.meta.url),'utf8'));
  db.exec("INSERT INTO member_profiles(id,issuer,subject,created_at) VALUES ('m','member-idp','1',1)");
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM staff_accounts').get().n,0);
  assert.throws(()=>db.exec("INSERT INTO staff_accounts(id,issuer,subject,role,created_at) VALUES ('s','staff-idp','1','paid',1)"));
  db.exec("INSERT INTO staff_accounts(id,issuer,subject,role,created_at) VALUES ('s','staff-idp','1','owner',1)");
  assert.equal(db.prepare("SELECT status FROM staff_accounts WHERE id='s'").get().status,'disabled');
  assert.throws(()=>db.exec("INSERT INTO member_profiles(id,issuer,subject,created_at) VALUES ('x','member-idp','1',1)"));
  assert.throws(()=>db.exec("INSERT INTO membership_entitlements(id,member_id,capability,valid_from,valid_until,source_ref) VALUES ('g','m','premium-research',20,10,'test')"));
  assert.throws(()=>db.exec("INSERT INTO membership_entitlements(id,member_id,capability,valid_from,valid_until,source_ref) VALUES ('g','missing','premium-research',10,20,'test')"));
 }finally{db.close()}
});
