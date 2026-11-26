import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const root='src/content/articles';
const fixture=mkdtempSync(join(root,'rr-test-'));
const npm=process.platform==='win32'?'npm.cmd':'npm';
const build=()=>spawnSync(npm,['run','build'],{stdio:'inherit',shell:process.platform==='win32'});
function expectBuild(success){
 const result=build();
 if(result.error)throw result.error;
 if(result.status===null)throw new Error('Build terminated: '+result.signal);
 assert.equal(result.status===0,success,success?'Build must succeed':'Invalid publication must fail validation');
}
const html=path=>readFileSync(join('dist',path,'index.html'),'utf8');
const basic=(type,slug,title)=>`---
title: ${title}
description: Synthetic test content only
slug: ${slug}
type: ${type}
areas: [msme-law]
jurisdiction: TEST ONLY
author: Synthetic test author
reviewer: Synthetic test reviewer
publishedAt: 2020-01-02
reviewedAt: 2020-01-02
sources:
  - title: Synthetic test reference
    url: https://example.invalid/fixture
    kind: primary
    pinpoint: Test paragraph 1
draft: false
`;
try{
 writeFileSync(join(fixture,'article.md'),basic('research','rr-test-article','RR TEST ARTICLE')+`---
## Synthetic section

Fixture only, not legal information.

### Nested heading

Test article body.
`);
 writeFileSync(join(fixture,'judgment.md'),basic('judgment','rr-test-case','RR TEST CASE')+`judgment:
  caseName: Synthetic case, not a real judgment
  court: Synthetic court
  decisionDate: 2020-01-01
  caseNumber: TEST-ONLY
  judgmentUrl: https://example.invalid/fixture
---
## Test reasoning

Synthetic body; never publish.
`);
 writeFileSync(join(fixture,'hidden.md'),`---
title: RR TEST HIDDEN DRAFT
description: Synthetic draft
slug: rr-test-hidden
type: research
areas: [msme-law]
jurisdiction: TEST ONLY
author: Synthetic test author
draft: true
---
Not a public article.
`);
 expectBuild(true);
 const article=html('research/rr-test-article');
 const judgment=html('judgments/rr-test-case');
 const home=html('');
 assert.match(article,/Synthetic test reviewer/);
 assert.match(article,/Synthetic test reference/);
 assert.match(article,/href="#synthetic-section"/);
 assert.match(article,/href="\/judgments\/rr-test-case\/"/);
 assert.match(judgment,/Synthetic court/);
 assert.match(judgment,/TEST-ONLY/);
 assert.match(judgment,/Read the judgment text/);
 assert.match(judgment,/href="\/research\/rr-test-article\/"/);
 assert.match(html('research'),/RR TEST ARTICLE/);
 assert.match(html('judgments'),/RR TEST CASE/);
 // Homepage shows at most six latest entries; fixture dates are intentionally historical.
 if(home.includes('RR TEST ARTICLE'))assert.match(home,/href="\/research\/rr-test-article\/"/);
 for(const page of [article,judgment,home,html('research')])assert.doesNotMatch(page,/RR TEST HIDDEN DRAFT/);
 assert.ok(!existsSync('dist/research/rr-test-hidden/index.html'));
 writeFileSync(join(fixture,'invalid.md'),`---
title: Invalid fixture
description: Missing required publication metadata
type: research
areas: [general]
jurisdiction: TEST ONLY
author: Synthetic test author
draft: false
---
Invalid publication.
`);
 expectBuild(false);
 console.log('Publication tests passed (routing, review metadata, citations, contents, related links, draft exclusion and invalid-entry rejection).');
}finally{
 rmSync(fixture,{recursive:true,force:true});
 // Always discard synthetic output and restore a clean production build.
 rmSync('dist',{recursive:true,force:true});
 expectBuild(true);
 assert.ok(!existsSync('dist/research/rr-test-article/index.html'));
 assert.ok(!existsSync('dist/judgments/rr-test-case/index.html'));
 assert.doesNotMatch(html(''),/RR TEST (ARTICLE|CASE|HIDDEN DRAFT)/);
}
