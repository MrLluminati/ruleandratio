import {readFileSync,mkdirSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {sourceCheckSummary} from '../src/lib/news-queue.mjs';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try{
 const args=process.argv.slice(2);if(args.length!==1)throw Error('Usage: npm run news:check -- path/to/check.json');
 const record=JSON.parse(readFileSync(resolve(args[0]),'utf8'));
 const registry=JSON.parse(readFileSync(new URL('../src/data/news-sources.json',import.meta.url),'utf8'));
 const dir=resolve('.rr-news/checks'),path=join(dir,'source-checks.json');
 const checks=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
 const updated=[...checks,record];sourceCheckSummary(updated,registry,today());
 mkdirSync(dir,{recursive:true});const tmp=path+'.tmp';writeFileSync(tmp,JSON.stringify(updated,null,2)+'\n',{flag:'wx'});renameSync(tmp,path);
 console.log('Manual source-check recorded. No website was fetched.');
}catch(e){console.error(e.message);process.exitCode=1}
