import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkStaging} from './studio-preflight.mjs';
import {accountOrigin} from '../src/lib/account-origin.mjs';
test('Account links remain opt-in and reject unsafe or placeholder origins',()=>{
 assert.equal(accountOrigin(undefined,'false'),undefined);
 assert.equal(accountOrigin('https://accounts.example.com','true'),'https://accounts.example.com');
 for(const value of [undefined,'http://accounts.example.com','https://admin.example.invalid','https://a.workers.dev','https://a.pages.dev','https://accounts.example.com/evil','https://user@accounts.example.com','https://accounts.example.com?foo=1'])assert.throws(()=>accountOrigin(value,'true'));
});
test('initial deployment requires distinct private databases and custom domains, with billing and workspace off',()=>{
 const make=(mode,host,db)=>({name:'rr-'+mode,main:'auth-worker.mjs',workers_dev:false,preview_urls:false,routes:[{pattern:host,custom_domain:true}],vars:{APP_MODE:mode,APP_ORIGIN:'https://'+host},d1_databases:[{binding:'DB',database_id:db}]});
 const s=make('staff','admin.example.com','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),m=make('member','account.example.com','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
 Object.assign(s.vars,{ACCESS_ISSUER:'https://example.cloudflareaccess.com',ACCESS_AUDIENCE:'real-audience',STUDIO_ENABLED:'false'});
 Object.assign(m.vars,{MEMBER_ISSUER:'https://example.auth0.com/',MEMBER_CLIENT_ID:'real-client',PUBLIC_SITE_ORIGIN:'https://www.example.com',MEMBER_WORKSPACE_ENABLED:'false',BILLING_MODE:'disabled'});
 assert.equal(checkStaging(s,m),true);
 assert.throws(()=>checkStaging(s,{...m,d1_databases:s.d1_databases}));
 assert.throws(()=>checkStaging(s,{...m,workers_dev:true}));
 assert.throws(()=>checkStaging(s,{...m,vars:{...m.vars,BILLING_MODE:'sandbox'}}));
 assert.throws(()=>checkStaging(s,{...m,vars:{...m.vars,MEMBER_CLIENT_SECRET:'test'}}));
 assert.throws(()=>checkStaging(s,{...m,routes:[]}));
});
