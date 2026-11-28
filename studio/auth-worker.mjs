import {createRemoteJWKSet,jwtVerify} from 'jose';
import {canStaff,canMember} from './permissions.mjs';
import {editorialRoute} from './editorial-workspace.mjs';
import {memberRoute} from './member-workspace.mjs';
import {billingWebhook} from './billing-sandbox.mjs';

const loginCookie='__Host-rr-login',sessionCookie='__Host-rr-member';
const nowSeconds=()=>Math.floor(Date.now()/1000);
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const hash=async s=>Array.from(await digest(s),b=>b.toString(16).padStart(2,'0')).join('');
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const safeToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const subject=s=>typeof s==='string'&&s.length>0&&s.length<=512;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookie=(name,value,age)=>name+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age='+age;
function readCookie(req,name){
 const values=(req.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'=')).map(x=>x.slice(name.length+1));
 return values.length===1&&safeToken(values[0])?values[0]:null;
}
function origin(s){try{const u=new URL(s);if(u.protocol==='https:'&&u.origin===s&&!u.username&&!u.password)return s}catch{}throw Error('Invalid configured HTTPS origin')}
function response(body,status=200,headers={}){
 const h=new Headers({'content-type':'text/html; charset=utf-8','cache-control':'no-store, private','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
 for(const [k,v] of Object.entries(headers))h.set(k,v);
 return new Response(body,{status,headers:h});
}
const page=(title,body,status=200)=>response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+' | Rule &amp; Ratio</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f5f6f4;color:#16283b;margin:0}main{max-width:640px;margin:6vh auto;padding:28px;background:white;border-top:3px solid #ac8b4c}h1,h2{font-family:Georgia,serif}header{letter-spacing:.14em;color:#08223d;font-weight:700;border-bottom:1px solid #ddd;padding-bottom:14px}a,button{color:#173d60}a.button,button{display:inline-block;border:1px solid #173d60;background:#173d60;color:white;padding:10px 16px;text-decoration:none;font:inherit;cursor:pointer}nav{display:flex;gap:12px;flex-wrap:wrap}small{color:#536575}</style></head><body><main><header>RULE &amp; RATIO</header><h1>'+esc(title)+'</h1>'+body+'</main></body></html>',status);
const redirect=(to,cookies=[])=>{const r=response(null,303,{location:to});for(const c of cookies)r.headers.append('set-cookie',c);return r};
const one=(u,k)=>{const v=u.searchParams.getAll(k);return v.length===1?v[0]:null};
const first=(db,sql,...args)=>db.prepare(sql).bind(...args).first();
const run=(db,sql,...args)=>db.prepare(sql).bind(...args).run();
const forbidden=()=>page('Access denied','<p>This account is not authorised for this resource.</p>',403);
const unauthorized=()=>page('Sign-in required','<p>Please sign in using the authorised login service.</p>',401);
const unavailable=()=>page('Temporarily unavailable','<p>The account service is not configured or could not complete the request. Try again later.</p>',503);
const validPost=(req,site)=>req.method==='POST'&&req.headers.get('origin')===site&&req.headers.get('sec-fetch-site')!=='cross-site';
const cache=new Map();
function keys(url){
 if(!cache.has(url))cache.set(url,createRemoteJWKSet(new URL(url),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000}));
 return cache.get(url);
}
export async function verifyStaffToken(token,issuer,audience,keyset){
 if(!token||token.length>16000||!audience)return null;
 try{
  const {payload}=await jwtVerify(token,keyset,{issuer,audience,algorithms:['RS256'],requiredClaims:['iss','sub','aud','exp','iat'],clockTolerance:5});
  return subject(payload.sub)&&payload.type==='app'&&typeof payload.email==='string'&&payload.email.length>0?payload:null;
 }catch{return null}
}
export async function verifyMemberToken(token,issuer,clientId,nonce,keyset){
 if(!token||token.length>16000||!clientId||!nonce)return null;
 try{
  const {payload}=await jwtVerify(token,keyset,{issuer,audience:clientId,algorithms:['RS256'],requiredClaims:['iss','sub','aud','exp','iat','nonce'],clockTolerance:5,maxTokenAge:'10m'});
  if(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==clientId||payload.azp!==undefined&&payload.azp!==clientId)return null;
  return subject(payload.sub)&&payload.nonce===nonce&&payload.email_verified===true?payload:null;
 }catch{return null}
}
// Dependency injection only for local tests; production default uses fixed configured issuers and real fetch.
// Keep the native fetch receiver intact in workerd; Node mocks can hide detached-fetch errors.
const nativeTokenFetch=(url,options)=>globalThis.fetch(url,options);
// Only constant stage/outcome labels and HTTP status codes; never log request URLs or exceptions.
const authDiagnostic=event=>console.info(JSON.stringify(event));
export function makeWorker({keyset=keys,fetchToken=nativeTokenFetch,clock=nowSeconds,diagnostic=authDiagnostic}={}){
 return {async fetch(req,env){
  let callbackStage=null;
  const report=(outcome,status)=>{if(callbackStage)try{diagnostic({event:'rr.auth.callback',stage:callbackStage,outcome,...(Number.isInteger(status)?{status}:{})})}catch{/* Diagnostics must not change authentication. */}};
  const mark=stage=>{callbackStage=stage;report('start')};
  try{
   if(!env.DB||!['staff','member'].includes(env.APP_MODE))return unavailable();
   const site=origin(env.APP_ORIGIN),u=new URL(req.url);
   if(u.origin!==site)return forbidden();
   if(!['GET','POST'].includes(req.method))return response('Method not allowed',405,{allow:'GET, POST'});
   const now=clock(),db=env.DB;
   if(env.APP_MODE==='staff'){
    const issuer=origin(env.ACCESS_ISSUER);
    if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!env.ACCESS_AUDIENCE)return unavailable();
    const claims=await verifyStaffToken(req.headers.get('cf-access-jwt-assertion'),issuer,env.ACCESS_AUDIENCE,keyset(issuer+'/cdn-cgi/access/certs'));
    if(!claims)return unauthorized();
    const row=await first(db,'SELECT id,role,status FROM staff_accounts WHERE issuer=? AND subject=?',issuer,claims.sub);
    const actor=row&&{...row,kind:'staff'};
    if(!canStaff(actor,'studio:read'))return forbidden();
    if(env.STUDIO_ENABLED==='true'&&(u.pathname==='/studio'||u.pathname.startsWith('/studio/')))return editorialRoute(req,db,actor,now);
    if(req.method!=='GET')return response('Method not allowed',405,{allow:'GET'});
    if(!['/','/api/session'].includes(u.pathname))return page('Not found','<p>No such staff route.</p>',404);
    if(u.pathname==='/'&&env.STUDIO_ENABLED==='true')return redirect('/studio');
    if(u.pathname==='/api/session')return response(JSON.stringify({kind:'staff',role:actor.role}),200,{'content-type':'application/json; charset=utf-8'});
    return page('Editorial Studio','<p>Signed in as authorised staff: <strong>'+esc(actor.role)+'</strong>.</p><p>Editorial tools will be connected in the next phase. No content editing or publication is enabled here.</p><a href="/cdn-cgi/access/logout">Sign out of staff access</a>');
   }
   if(u.pathname==='/webhooks/razorpay-test')return billingWebhook(req,env,now);
   const issuerOrigin=origin(env.MEMBER_ISSUER?.replace(/\/$/,''));
   const issuer=issuerOrigin+'/',client=env.MEMBER_CLIENT_ID;
   if(!client||!env.MEMBER_CLIENT_SECRET)return unavailable();
   if(u.pathname==='/login'||u.pathname==='/register'){
    if(req.method!=='GET')return response('Method not allowed',405,{allow:'GET'});
    const state=random(),verifier=random(),nonce=random();
    await run(db,'DELETE FROM member_login_attempts WHERE expires_at<=?',now);
    await run(db,'INSERT INTO member_login_attempts(state_hash,verifier,nonce,expires_at) VALUES (?,?,?,?)',await hash(state),verifier,nonce,now+600);
    const url=new URL(issuer+'authorize');
    url.search=new URLSearchParams({client_id:client,response_type:'code',scope:'openid email',redirect_uri:site+'/callback',state,nonce,code_challenge: b64url(await digest(verifier)),code_challenge_method:'S256',prompt:'login',...(u.pathname==='/register'?{screen_hint:'signup'}:{})}).toString();
    return redirect(url.href,[cookie(loginCookie,state,600)]);
   }
   if(u.pathname==='/callback'){
    mark('validate_request');
    if(req.method!=='GET')return response('Method not allowed',405,{allow:'GET'});
    const state=one(u,'state'),code=one(u,'code');
    if(!safeToken(state)||state!==readCookie(req,loginCookie)||!code||code.length>4096||u.searchParams.has('error'))return page('Sign-in unsuccessful','<p>Start a new sign-in attempt.</p><a href="/login">Sign in again</a>',400);
    // Atomic consumption: the same state cannot complete a second time.
    mark('consume_attempt');
    const attempt=await first(db,'DELETE FROM member_login_attempts WHERE state_hash=? AND expires_at>? RETURNING verifier,nonce',await hash(state),now);
    if(!attempt)return page('Sign-in expired','<p>Start a new sign-in attempt.</p><a href="/login">Sign in again</a>',400);
    mark('exchange_code');
    const tokenResponse=await fetchToken(issuer+'oauth/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:client,client_secret:env.MEMBER_CLIENT_SECRET,code,code_verifier:attempt.verifier,redirect_uri:site+'/callback'}),redirect:'manual',signal:AbortSignal.timeout(8000)});
    // Workers supports manual redirects, not redirect:error. Never forward OAuth credentials.
    if(tokenResponse.status>=300&&tokenResponse.status<400){report('redirect_rejected',tokenResponse.status);return unauthorized()}
    if(!tokenResponse.ok){report('rejected',tokenResponse.status);return unauthorized()}
    report('success',tokenResponse.status);
    mark('decode_response');
    const tokens=await tokenResponse.json();
    mark('verify_id_token');
    const claims=await verifyMemberToken(tokens.id_token,issuer,client,attempt.nonce,keyset(issuer+'.well-known/jwks.json'));
    if(!claims){report('rejected',403);return page('Verification required','<p>Sign in with a verified email address and try again.</p><a href="/login">Sign in again</a>',403)}
    // Never link identities by email, never write to staff_accounts.
    mark('upsert_member');
    await run(db,'INSERT INTO member_profiles(id,issuer,subject,created_at) VALUES (?,?,?,?) ON CONFLICT(issuer,subject) DO NOTHING',crypto.randomUUID(),issuer,claims.sub,now);
    mark('read_member');
    const member=await first(db,'SELECT id,status FROM member_profiles WHERE issuer=? AND subject=?',issuer,claims.sub);
    if(!member||member.status!=='active')return forbidden();
    mark('create_session');
    const prior=readCookie(req,sessionCookie);
    if(prior)await run(db,'DELETE FROM member_sessions WHERE token_hash=?',await hash(prior));
    await run(db,'DELETE FROM member_sessions WHERE expires_at<=?',now);
    const session=random(),expiry=Math.min(now+3600,claims.exp);
    if(expiry<=now)return unauthorized();
    await run(db,'INSERT INTO member_sessions(token_hash,member_id,created_at,expires_at) VALUES (?,?,?,?)',await hash(session),member.id,now,expiry);
    mark('complete');
    report('success',303);
    return redirect('/',[cookie(loginCookie,'',0),cookie(sessionCookie,session,expiry-now)]);
   }
   const token=readCookie(req,sessionCookie);
   const member=token&&await first(db,'SELECT m.id,m.display_name,m.status FROM member_sessions s JOIN member_profiles m ON s.member_id=m.id WHERE s.token_hash=? AND s.expires_at>?',await hash(token),now);
   const actor=member&&{...member,kind:'member'};
   const active=canMember(actor,'profile:read',{memberId:member?.id});
   if(u.pathname==='/logout'){
    if(!validPost(req,site))return forbidden();
    if(token)await run(db,'DELETE FROM member_sessions WHERE token_hash=?',await hash(token));
    const url=new URL(issuer+'oidc/logout');url.search=new URLSearchParams({client_id:client,post_logout_redirect_uri:site+'/'}).toString();
    return redirect(url.href,[cookie(sessionCookie,'',0),cookie(loginCookie,'',0)]);
   }
   if(env.MEMBER_WORKSPACE_ENABLED==='true'&&(u.pathname==='/account'||u.pathname.startsWith('/account/')))return memberRoute(req,db,actor,token?await hash(token):null,now,env.PUBLIC_SITE_ORIGIN,env);
   if(req.method!=='GET')return response('Method not allowed',405,{allow:'GET'});
   if(u.pathname==='/api/session'){
    if(!active)return unauthorized();
    return response(JSON.stringify({kind:'member',displayName:member.display_name}),200,{'content-type':'application/json; charset=utf-8'});
   }
   if(u.pathname!=='/')return page('Not found','<p>No such member route.</p>',404);
   if(!active)return page('Member account','<p>Sign in or register to use your personal Rule &amp; Ratio account.</p><nav><a class="button" href="/login">Sign in</a><a href="/register">Create account</a></nav><p><small>Membership never grants editorial access. Payments are not yet enabled.</small></p>');
   if(env.MEMBER_WORKSPACE_ENABLED==='true')return redirect('/account');
   return page('My account','<p>Signed in'+(member.display_name?' as '+esc(member.display_name):'')+'.</p><p>Member profile and subscription features are being prepared.</p><form method="post" action="/logout"><button type="submit">Sign out</button></form>');
  }catch{report('exception',503);return unavailable()}
 }};
}
export default makeWorker();
