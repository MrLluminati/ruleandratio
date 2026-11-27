import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {validateLead} from '../src/lib/news.mjs';
const args=process.argv.slice(2);
if(args.length!==1){console.error('Usage: npm run news:intake -- path/to/lead.json');process.exit(1)}
try{
 const registry=JSON.parse(readFileSync(new URL('../src/data/news-sources.json',import.meta.url),'utf8'));
 const lead=validateLead(JSON.parse(readFileSync(resolve(args[0]),'utf8')),registry);
 const dir=resolve('.rr-news');
 mkdirSync(dir,{recursive:true});
 const out=join(dir,lead.id+'.json');
 const record={...lead,stage:'verification-required',publicationAllowed:false,checklist:['Obtain exact primary document and verify event date','Confirm court or authority, case/notification identifier and operative effect','Check reporting restrictions, privacy and confidentiality','Verify current status, amendments and subsequent orders','Write original report and attribute relied-upon sources','Obtain genuine human editorial approval before publishing']};
 writeFileSync(out,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log('Local unverified lead saved: '+out+' (no publication)');
}catch(e){console.error(e.message);process.exitCode=1}
