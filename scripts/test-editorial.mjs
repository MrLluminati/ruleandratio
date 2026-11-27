import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {makeItem,createReview,reviewState,prepare,parseArticle,inventory,buildReport,dashboard} from './editorial.mjs';
const fixture='---\ntitle: "Synthetic <script>alert(1)</script>"\ndescription: Synthetic fixture\nslug: test-note\ntype: education\nareas: [general]\njurisdiction: TEST ONLY\nauthor: Test author\ndraft: true\nsources:\n  - title: Test source\n    url: https://example.invalid/test\n    kind: primary\n    pinpoint: Test paragraph 1\n---\nSynthetic body.\n';
const item=()=>makeItem('src/content/articles/test.md',fixture,'article');
function approved(i){
 const r=createReview(i);r.decision='approved';r.reviewer='Synthetic test reviewer';r.reviewedAt='2020-01-01';r.note='Synthetic fixture only';
 for(const k of Object.keys(r.checks))r.checks[k]=true;
 for(const s of Object.values(r.sources)){s.verified=true;s.note='Synthetic source verification'}
 return r;
}
test('review is explicit, complete and bound to exact draft bytes',()=>{
 const i=item(),r=approved(i);
 assert.equal(reviewState(i,null).status,'queued');
 assert.equal(reviewState(i,createReview(i)).status,'in-review');
 assert.equal(reviewState(i,r).status,'ready');
 assert.equal(reviewState(makeItem(i.path,fixture+'Edit\n','article'),r).status,'stale');
 const pending=structuredClone(r);pending.sources[i.sources[0].key].verified=false;
 assert.equal(reviewState(i,pending).status,'incomplete');
 const blocked=structuredClone(r);blocked.decision='blocked';assert.equal(reviewState(i,blocked).status,'blocked');
 const future=structuredClone(r);future.reviewedAt='2999-01-01';assert.equal(reviewState(i,future).status,'incomplete');
 const internal=makeItem(i.path,fixture+'\n## Verification pending\nDo not publish.\n','article');
 assert.equal(reviewState(internal,approved(internal)).status,'incomplete');
});
test('prepare emits a candidate but not on incomplete or stale review',()=>{
 const i=item(),r=approved(i);
 assert.throws(()=>prepare(i,createReview(i),'2020-01-02'));
 assert.throws(()=>prepare(i,r,'2019-01-01'));
 const result=parseArticle(prepare(i,r,'2020-01-02'));
 assert.equal(result.data.draft,false);assert.equal(result.data.reviewer,r.reviewer);assert.equal(result.body,i.body);assert.equal(i.data.draft,true);
});
test('statute review requires text, original commentary and legal status',()=>{
 const raw=JSON.stringify({slug:'test-act',title:'Test Act',draft:true,areas:['general'],status:'uncertain',source:{title:'Test',url:'https://example.invalid',pinpoint:'Section 1'},provisions:[{slug:'section-1',versions:[{id:'original',text:'Synthetic',source:{title:'Test',url:'https://example.invalid',pinpoint:'Section 1'}}]}]});
 const i=makeItem('.rr-import/test-act/draft.json',raw,'import');assert.equal(reviewState(i,approved(i)).status,'incomplete');
 const d=JSON.parse(raw);d.provisions[0].commentary='Synthetic note';const j=makeItem(i.path,JSON.stringify(d),'import');assert.equal(reviewState(j,approved(j)).status,'ready');
});
test('inventory joins acquisition maps and escapes dashboard markup',()=>{
 const root=mkdtempSync(join(tmpdir(),'rr-editorial-'));
 const put=(p,data)=>{const file=join(root,p);mkdirSync(dirname(file),{recursive:true});writeFileSync(file,data)};
 try{
  put('src/content/articles/test.md',fixture);
  put('docs/acquisition/test.json',JSON.stringify({slug:'test-act',title:'Test act',state:'source-map-only',source:{url:'https://example.invalid'},provisions:[{id:'section-1',draftArticle:'src/content/articles/test.md'}]}));
  const i=inventory(root).items[0];assert.equal(i.candidates[0].status,'unresolved-manual-check');
  put('.rr-editorial/reviews/'+i.id+'.json',JSON.stringify(approved(i)));
  const report=buildReport(root);assert.equal(report.counts.ready,1);
  const html=dashboard(report);assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
  put('src/content/articles/duplicate.md',fixture);assert.throws(()=>inventory(root),/Duplicate editorial ID/);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('rejects duplicate frontmatter keys and unsafe sources',()=>{
 assert.throws(()=>parseArticle(fixture.replace('draft: true','draft: true\ndraft: false')));
 assert.throws(()=>makeItem('src/content/articles/test.md',fixture.replace('https://example.invalid/test','javascript:alert(1)'),'article'));
});
