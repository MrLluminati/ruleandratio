import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {buildEditorialQueue,sourceCheckSummary} from '../src/lib/news-queue.mjs';
const indiaDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try{
 const args=process.argv.slice(2);
 if(args.length>1)throw Error('Usage: npm run news:queue -- [YYYY-MM-DD]');
 const asOf=args[0]??indiaDay();
 if(asOf>indiaDay())throw Error('Queue date cannot be in the future');
 const registry=JSON.parse(readFileSync(new URL('../src/data/news-sources.json',import.meta.url),'utf8'));
 const dir=resolve('.rr-news'),leadDir=dir,checkPath=join(dir,'checks','source-checks.json');
 const leads=existsSync(leadDir)?readdirSync(leadDir,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.endsWith('.json')).map(e=>{const record=JSON.parse(readFileSync(join(leadDir,e.name),'utf8'));if(e.name!==record.id+'.json'||record.stage!=='verification-required'||record.publicationAllowed!==false)throw Error('Unexpected intake file: '+e.name);return record}):[];
 const checks=existsSync(checkPath)?JSON.parse(readFileSync(checkPath,'utf8')):[];
 const queue=buildEditorialQueue(leads,registry,asOf);
 const report={...queue,sourceChecks:sourceCheckSummary(checks,registry,asOf),note:'Local unverified research queue. Score is editorial triage only, not authenticity or legal importance. No sources were fetched.'};
 const out=join(dir,'reports');mkdirSync(out,{recursive:true});
 const path=join(out,'queue-'+asOf+'.json');writeFileSync(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log('Local queue saved: '+path);
 console.log(queue.totalLeads+' leads / '+queue.distinctDocumentGroups+' document groups / '+queue.candidates.length+' candidate links');
 console.log(report.sourceChecks.filter(s=>s.due).length+' sources due for manual check. No publication.');
}catch(e){console.error(e.message);process.exitCode=1}
