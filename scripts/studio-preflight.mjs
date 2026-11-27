import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
function requireThat(ok,message){if(!ok)throw Error(message)}
function customOrigin(v){try{const u=new URL(v);return u.origin===v&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&u.hostname.includes('.')&&!/\.(invalid|workers\.dev|pages\.dev)$/.test(u.hostname)&&u.hostname!=='localhost'}catch{return false}}
const actual=s=>typeof s==='string'&&s.length>=3&&!/REPLACE|example\.invalid/i.test(s);
export function checkStaging(staff,member){
 for(const [mode,c] of [['staff',staff],['member',member]]){
  requireThat(c?.vars?.APP_MODE===mode,'Wrong app mode: '+mode);
  requireThat(c.workers_dev===false&&c.preview_urls===false,'Disable alternate worker origins: '+mode);
  requireThat(c.main==='auth-worker.mjs','Unexpected worker entry: '+mode);
  requireThat(customOrigin(c.vars.APP_ORIGIN),'Confirm actual HTTPS custom origin: '+mode);
  requireThat(Array.isArray(c.d1_databases)&&c.d1_databases.length===1&&c.d1_databases[0].binding==='DB','One DB binding required: '+mode);
  requireThat(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.d1_databases[0].database_id),'Real database ID required: '+mode);
  requireThat(!Object.keys(c.vars).some(k=>/SECRET|TOKEN|PASSWORD|PRIVATE_KEY/.test(k)),'Secrets must use Worker secret storage');
  requireThat(c.routes?.length===1&&c.routes[0].custom_domain===true&&c.routes[0].pattern===new URL(c.vars.APP_ORIGIN).hostname,'Exact custom-domain route required: '+mode);
 }
 requireThat(staff.name!==member.name&&staff.vars.APP_ORIGIN!==member.vars.APP_ORIGIN&&staff.d1_databases[0].database_id!==member.d1_databases[0].database_id,'Staff and member resources must be separate');
 requireThat(/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(staff.vars.ACCESS_ISSUER)&&actual(staff.vars.ACCESS_AUDIENCE),'Real Access issuer and audience required');
 requireThat(actual(member.vars.MEMBER_CLIENT_ID)&&actual(member.vars.MEMBER_ISSUER)&&customOrigin(member.vars.MEMBER_ISSUER.replace(/\/$/,'')),'Real member identity provider required');
 requireThat(customOrigin(member.vars.PUBLIC_SITE_ORIGIN)&&![staff.vars.APP_ORIGIN,member.vars.APP_ORIGIN].includes(member.vars.PUBLIC_SITE_ORIGIN),'Confirm separate public site origin');
 requireThat(staff.vars.STUDIO_ENABLED==='false'&&member.vars.MEMBER_WORKSPACE_ENABLED==='false'&&member.vars.BILLING_MODE==='disabled','Initial deployment must keep workspace and billing disabled');
 return true;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const [s,m]=process.argv.slice(2);if(!s||!m)throw Error('Usage: node scripts/studio-preflight.mjs staff.jsonc member.jsonc (strict JSON files)');checkStaging(JSON.parse(readFileSync(s,'utf8')),JSON.parse(readFileSync(m,'utf8')));console.log('Staging configuration checks passed. This does not verify deployed Access policy, secrets, DNS or database.');}catch(e){console.error(e.message);process.exitCode=1}
}
