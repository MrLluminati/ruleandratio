import {test} from 'node:test';
import assert from 'node:assert/strict';
import {indiaDate,validDate,versionStatus,matchingVersions,matchesQuery} from '../src/lib/statute-versions.mjs';
const versions=[{id:'old',effectiveFrom:'2020-01-01',effectiveUntil:'2021-01-01'},{id:'new',effectiveFrom:'2021-01-01'},{id:'undated'}];
test('exclusive boundaries, future, gaps and undated text',()=>{
 assert.equal(versionStatus(versions[0],'2020-01-01'),'date-match');
 assert.equal(versionStatus(versions[0],'2021-01-01'),'historical');
 assert.equal(versionStatus(versions[1],'2020-12-31'),'future');
 assert.equal(versionStatus(versions[2],'2021-01-01'),'undated');
 assert.deepEqual(matchingVersions(versions,'2019-12-31'),[]);
 assert.deepEqual(matchingVersions(versions,'2021-01-01').map(v=>v.id),['new']);
 assert.deepEqual(matchingVersions(versions,'2021-02-29'),[]);
 assert.equal(validDate('2024-02-29'),true);
 assert.equal(indiaDate(new Date('2026-11-27T19:00:00Z')),'2026-11-28');
});
test('directory query handles numbers and words',()=>{
 assert.ok(matchesQuery('Section 15A — Trade receivables','15a trade'));
 assert.ok(matchesQuery('Section 18 — Reference to Council','section-18'));
 assert.ok(!matchesQuery('Section 18 — Reference to Council','section 19'));
});
