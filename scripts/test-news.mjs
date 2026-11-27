import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateLead,validateNewsRegistry,validDay} from '../src/lib/news.mjs';
const registry=JSON.parse(readFileSync(new URL('../src/data/news-sources.json',import.meta.url),'utf8'));
const lead={id:'synthetic-lead',sourceId:'supreme-court',title:'Synthetic fixture',kind:'judicial-decision',eventDate:'2024-01-01',capturedOn:'2024-01-02',url:'https://example.invalid/fixture.pdf',areas:['general'],status:'unverified',notes:'Fixture only'};
test('news registry manual access only',()=>{assert.equal(validateNewsRegistry(registry).length,17);assert.throws(()=>validateNewsRegistry([...registry,registry[0]]));assert.throws(()=>validateNewsRegistry([{...registry[0],automatedAccess:true}]))});
test('news leads require valid dates, sources and document link',()=>{assert.equal(validateLead(lead,registry,'2024-01-03').sourceKind,'primary');assert.equal(validDay('2023-02-29'),false);for(const patch of [{sourceId:'unknown'},{url:'https://example.invalid/'},{eventDate:'2024-02-01'},{status:'verified'},{kind:'unknown'},{id:'../bad'}])assert.throws(()=>validateLead({...lead,...patch},registry,'2024-01-03'))});

import {buildEditorialQueue,canonicalLeadUrl,sourceCheckSummary} from '../src/lib/news-queue.mjs';
test('document groups preserve all source leads and distinguish subsequent orders',()=>{
 const base={...lead,authority:'Synthetic court',identifier:'TEST 123',eventDate:'2024-01-02',capturedOn:'2024-01-02'};
 const q=buildEditorialQueue([base,{...base,id:'duplicate',url:base.url+'?utm_source=test'},{...base,id:'separate',eventDate:'2024-01-01'},{...base,id:'other-report',sourceId:'livelaw',url:'https://example.invalid/report'}],registry,'2024-01-03');
 assert.equal(q.totalLeads,4);assert.equal(q.distinctDocumentGroups,3);assert.equal(q.groupedAdditionalLeads,1);assert.equal(q.items[0].leadIds.length,2);assert.equal(q.candidates.length,3);assert.ok(q.items.every(i=>i.publicationAllowed===false));assert.equal(canonicalLeadUrl('https://example.invalid/a?id=1&utm_source=x#p2'),'https://example.invalid/a?id=1#p2');
});
test('priority is explicit, not inferred legal importance',()=>{
 const high={...lead,id:'urgent',editorPriority:'urgent',priorityReason:'Synthetic editor rationale',url:'https://example.invalid/other'};
 const q=buildEditorialQueue([lead,high],registry,'2024-01-03');assert.equal(q.items[0].id,'urgent');assert.equal(q.items[0].scoreBreakdown.editorPriority,4);assert.throws(()=>buildEditorialQueue([{...high,priorityReason:''}],registry,'2024-01-03'));assert.throws(()=>buildEditorialQueue([lead,lead],registry,'2024-01-03'));
});
test('manual check status and access constraints',()=>{
 const checks=[{sourceId:'supreme-court',checkedOn:'2024-01-03',outcome:'checked',notes:''},{sourceId:'livelaw',checkedOn:'2024-01-01',outcome:'unavailable',notes:''},{sourceId:'manupatra',checkedOn:'2024-01-03',outcome:'not-authorized',notes:''}];
 const summary=sourceCheckSummary(checks,registry,'2024-01-03');
 assert.equal(summary.find(x=>x.sourceId==='supreme-court').due,false);assert.equal(summary.find(x=>x.sourceId==='livelaw').due,true);assert.match(summary.find(x=>x.sourceId==='manupatra').note,/authorization/);assert.equal(summary.find(x=>x.sourceId==='gazette').lastChecked,null);assert.throws(()=>sourceCheckSummary([...checks,checks[0]],registry,'2024-01-03'));
});
