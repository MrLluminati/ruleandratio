// Sandbox-only. Never enable against a production member database.
const provider='razorpay-test';
const prep=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>prep(db,sql,...args).first();
const all=async(db,sql,...args)=>(await prep(db,sql,...args).all()).results;
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const id=(v,prefix)=>typeof v==='string'&&new RegExp('^'+prefix+'_[A-Za-z0-9]{1,80}$').test(v);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const result=(message,status=200)=>new Response(JSON.stringify({message}),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','x-robots-tag':'noindex'}});
export async function billingEnabled(env){
 if(env.BILLING_MODE!=='sandbox'||!/^rzp_test_[A-Za-z0-9]+$/.test(env.RAZORPAY_KEY_ID??'')||!env.RAZORPAY_KEY_SECRET||!env.RAZORPAY_WEBHOOK_SECRET||!id(env.RAZORPAY_ACCOUNT_ID,'acc'))return false;
 const row=await first(env.DB,'SELECT enabled FROM billing_sandbox_settings WHERE id=1 AND razorpay_account_id=?',env.RAZORPAY_ACCOUNT_ID);
 return row?.enabled===1;
}
export async function verifyWebhook(raw,signature,secret){
 if(typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature)||typeof secret!=='string'||!secret)return false;
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),s=>parseInt(s,16)),raw);
}
async function rawBody(req){
 const reader=req.body?.getReader();if(!reader)return null;
 let n=0;const parts=[];
 while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>262144){await reader.cancel();return null}parts.push(value)}
 const raw=new Uint8Array(n);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.byteLength}return raw;
}
async function paymentFromAPI(paymentId,env,fetcher){
 if(!id(paymentId,'pay'))throw Error('Invalid payment ID');
 const res=await fetcher('https://api.razorpay.com/v1/payments/'+paymentId,{headers:{authorization:'Basic '+btoa(env.RAZORPAY_KEY_ID+':'+env.RAZORPAY_KEY_SECRET),accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!res.ok)throw Error('Payment reconciliation unavailable');
 return res.json();
}
const lifecycle=new Set(['subscription.authenticated','subscription.activated','subscription.charged','subscription.completed','subscription.updated','subscription.pending','subscription.halted','subscription.cancelled','subscription.paused','subscription.resumed']);
const refunds=new Set(['refund.created','refund.processed','refund.failed','refund.speed_changed']);
export async function billingWebhook(req,env,now,{fetcher=fetch}={}){
 try{
  if(req.method!=='POST')return result('Method not allowed',405);
  if(!await billingEnabled(env))return result('Not found',404);
  const raw=await rawBody(req);
  if(!raw)return result('Invalid body',413);
  if(!await verifyWebhook(raw,req.headers.get('x-razorpay-signature'),env.RAZORPAY_WEBHOOK_SECRET))return result('Invalid signature',401);
  const eventId=req.headers.get('x-razorpay-event-id');
  if(!eventId||!/^[A-Za-z0-9_-]{1,150}$/.test(eventId))return result('Invalid event ID',400);
  let e;try{e=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{return result('Invalid event',400)}
  if(e?.account_id!==env.RAZORPAY_ACCOUNT_ID||!integer(e.created_at)||e.created_at>now+300)return result('Invalid account or time',400);
  if(!lifecycle.has(e.event)&&!refunds.has(e.event))return result('Ignored event');
  const db=env.DB,digest=hex(await crypto.subtle.digest('SHA-256',raw));
  const existing=await first(db,'SELECT payload_sha256 FROM billing_events WHERE provider=? AND event_id=?',provider,eventId);
  if(existing)return result(existing.payload_sha256===digest?'Already recorded':'Event ID conflict',existing.payload_sha256===digest?200:409);
  const s=e.payload?.subscription?.entity,p=e.payload?.payment?.entity,r=e.payload?.refund?.entity;
  let sub=null,paymentId=null,charge=null,hold=null;
  if(lifecycle.has(e.event)){
   if(!id(s?.id,'sub'))return result('Invalid subscription',400);
   sub=await first(db,'SELECT s.*,p.provider_plan_id,p.period FROM billing_subscriptions s JOIN billing_plans p ON p.id=s.plan_id WHERE s.provider_subscription_id=?',s.id);
   // A signed event alone cannot associate a subscription with a member.
   if(!sub)return result('Subscription mapping not provisioned',503);
   if(s.plan_id!==sub.provider_plan_id||s.quantity!==1)return result('Plan or quantity mismatch',422);
   if(id(p?.id,'pay'))paymentId=p.id;
   if(e.event==='subscription.charged'){
    const start=s.current_start,end=s.current_end,cycle=s.paid_count;
    const maxDays=sub.period==='monthly'?32:367,minDays=sub.period==='monthly'?27:364;
    if(!paymentId||!id(p.invoice_id,'inv')||p.status!=='captured'||p.currency!=='INR'||p.amount!==sub.expected_amount_paise||!integer(start)||!integer(end)||end-start<minDays*86400||end-start>maxDays*86400||!integer(cycle)||cycle===0||start>now+300)return result('Charge needs manual reconciliation',422);
    // The signed subscription.charged payload binds this payment to its exact cycle;
    // the independent API fetch confirms capture, amount, invoice and current refund state.
    const verified=await paymentFromAPI(paymentId,env,fetcher);
    if(verified.id!==paymentId||verified.invoice_id!==p.invoice_id||verified.amount!==p.amount||verified.currency!=='INR'||!integer(verified.amount_refunded))return result('Payment reconciliation mismatch',422);
    if(verified.amount_refunded>0||verified.status==='refunded')hold={paymentId,refundId:'observed-refund'};
    else if(verified.status!=='captured')return result('Payment not captured',422);
    else charge={paymentId,invoice:p.invoice_id,cycle,start,end,amount:p.amount};
   }
  }else{
   if(!id(r?.id,'rfnd')||!id(r.payment_id,'pay'))return result('Invalid refund',400);
   paymentId=r.payment_id;
   if(e.event==='refund.created'||e.event==='refund.processed')hold={paymentId,refundId:r.id};
  }
  // D1 batch is atomic. Every event mutation is conditioned on the exact ledger digest.
  // A different payload with the same event ID cannot modify the ledger during a race.
  const guard="EXISTS(SELECT 1 FROM billing_events WHERE provider=? AND event_id=? AND payload_sha256=?)";
  const g=[provider,eventId,digest],q=[
   prep(db,'INSERT INTO billing_events(provider,event_id,payload_sha256,received_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING',provider,eventId,digest,now),
   prep(db,'INSERT INTO billing_event_details(provider,event_id,event_type,subscription_id,payment_id,occurred_at) SELECT ?,?,?,?,?,? WHERE '+guard+' ON CONFLICT DO NOTHING',provider,eventId,e.event,sub?.id??null,paymentId,e.created_at,...g)
  ];
  if(hold){
   q.push(prep(db,'INSERT INTO billing_refund_holds(payment_id,refund_id,recorded_at) SELECT ?,?,? WHERE '+guard+' ON CONFLICT DO NOTHING',hold.paymentId,hold.refundId,now,...g));
   q.push(prep(db,'UPDATE membership_entitlements SET revoked_at=COALESCE(revoked_at,?) WHERE source_ref=? AND '+guard,now,provider+':'+hold.paymentId,...g));
  }
  if(charge){
   const c=charge,ref=provider+':'+c.paymentId;
   q.push(prep(db,'INSERT INTO billing_charges(payment_id,invoice_id,subscription_id,cycle_number,amount_paise,period_start,period_end,verified_at) SELECT ?,?,?,?,?,?,?,? WHERE '+guard+' ON CONFLICT DO NOTHING',c.paymentId,c.invoice,sub.id,c.cycle,c.amount,c.start,c.end,now,...g));
   // No extension by replay or by a second payment claiming the same invoice/cycle.
   // A refund hold may arrive before the charge; it permanently blocks automatic re-grant.
   q.push(prep(db,"INSERT INTO membership_entitlements(id,member_id,capability,valid_from,valid_until,source_ref) SELECT ?,s.member_id,'premium-research',c.period_start,c.period_end,? FROM billing_charges c JOIN billing_subscriptions s ON s.id=c.subscription_id WHERE c.payment_id=? AND c.invoice_id=? AND c.subscription_id=? AND c.cycle_number=? AND c.amount_paise=? AND c.period_start=? AND c.period_end=? AND NOT EXISTS(SELECT 1 FROM billing_refund_holds h WHERE h.payment_id=c.payment_id) AND "+guard+" ON CONFLICT DO NOTHING",ref,ref,c.paymentId,c.invoice,sub.id,c.cycle,c.amount,c.start,c.end,...g));
  }
  await db.batch(q);
  const saved=await first(db,'SELECT payload_sha256 FROM billing_events WHERE provider=? AND event_id=?',provider,eventId);
  if(saved?.payload_sha256!==digest)return result('Event ID conflict',409);
  return result('Recorded');
 }catch{return result('Billing reconciliation unavailable',503)}
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const amount=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(n/100);
const date=n=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(n*1000));
function checkoutLink(s){try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='rzp.io'&&!u.port&&!u.username&&!u.password&&/^\/(?:rzp|i)\/[A-Za-z0-9]+$/.test(u.pathname)&&!u.search&&!u.hash?u.href:null}catch{return null}}
const active="EXISTS(SELECT 1 FROM member_sessions ms JOIN member_profiles m ON m.id=ms.member_id WHERE ms.token_hash=? AND ms.member_id=? AND ms.expires_at>? AND m.status='active')";
export async function billingPanel(env,memberId,sessionHash,now){
 if(!await billingEnabled(env))return '';
 const db=env.DB,session=[sessionHash,memberId,now];
 const plans=await all(db,'SELECT title,period,amount_paise FROM billing_plans WHERE enabled=1 AND '+active+' ORDER BY amount_paise',...session);
 const subs=await all(db,'SELECT s.*,p.title,p.period,c.status AS cancellation_status,(SELECT event_type FROM billing_event_details e WHERE e.subscription_id=s.id ORDER BY occurred_at DESC,event_id DESC LIMIT 1) AS last_event FROM billing_subscriptions s JOIN billing_plans p ON p.id=s.plan_id LEFT JOIN billing_cancellation_requests c ON c.subscription_id=s.id WHERE s.member_id=? AND '+active+' ORDER BY s.created_at DESC LIMIT 20',memberId,...session);
 const charges=await all(db,'SELECT c.*,p.title,h.payment_id AS refund_hold FROM billing_charges c JOIN billing_subscriptions s ON s.id=c.subscription_id JOIN billing_plans p ON p.id=s.plan_id LEFT JOIN billing_refund_holds h ON h.payment_id=c.payment_id WHERE s.member_id=? AND '+active+' ORDER BY verified_at DESC LIMIT 100',memberId,...session);
 return '<section><h2>Subscription sandbox</h2><p class="notice">TEST MODE — no real payment. Subscription links are provisioned by the operator. A cancellation request is not a confirmed cancellation; the operator must complete it in the gateway dashboard.</p><h3>Configured test plans</h3>'+(plans.map(p=>'<p>'+esc(p.title)+' · '+esc(amount(p.amount_paise))+' / '+esc(p.period)+'</p>').join('')||'<p>No test prices configured.</p>')+'<h3>My test subscriptions</h3>'+(subs.map(s=>{
  const url=checkoutLink(s.checkout_url);
  return '<div class="row"><strong>'+esc(s.title)+'</strong><p>'+esc(amount(s.expected_amount_paise))+' · '+esc(s.period)+'</p><p>Latest recorded event: '+esc(s.last_event??'Awaiting authorisation')+'</p>'+(url&&s.checkout_expires_at>now&&!s.last_event&&!s.cancellation_status?'<a class="button" href="'+esc(url)+'" rel="noreferrer">Open test checkout</a>':'')+(s.cancellation_status?'<p>Cancellation request: '+esc(s.cancellation_status)+'</p>':'<form method="post" action="/account/billing/cancel"><input type="hidden" name="subscription" value="'+esc(s.id)+'"><label><input style="width:auto" type="checkbox" name="confirm" value="yes"> Request cancellation at cycle end</label><button>Submit cancellation request</button></form>')+'</div>';
 }).join('')||'<p>No linked test subscriptions.</p>')+'<h3>Verified test charges</h3>'+(charges.map(c=>'<div class="row"><strong>'+esc(c.title)+' · '+esc(amount(c.amount_paise))+'</strong><p>'+esc(date(c.period_start))+' – '+esc(date(c.period_end))+' · '+(c.refund_hold?'Refund hold — access revoked':'Captured and verified')+'</p><small>'+esc(c.payment_id)+'</small></div>').join('')||'<p>No verified charges.</p>')+'<p>These records are not tax invoices or proof of real payment.</p></section>';
}
export async function requestCancellation(env,memberId,sessionHash,now,form){
 if(!await billingEnabled(env))return false;
 const subscription=form.get('subscription');
 if(typeof subscription!=='string'||!/^[a-z0-9-]{1,100}$/.test(subscription)||form.get('confirm')!=='yes'||[...form.keys()].some(k=>!['subscription','confirm'].includes(k)))return false;
 const db=env.DB;
 await prep(db,'INSERT INTO billing_cancellation_requests(subscription_id,requested_at) SELECT id,? FROM billing_subscriptions WHERE id=? AND member_id=? AND '+active+' ON CONFLICT DO NOTHING',now,subscription,memberId,sessionHash,memberId,now).run();
 const row=await first(db,'SELECT c.subscription_id FROM billing_cancellation_requests c JOIN billing_subscriptions s ON s.id=c.subscription_id WHERE s.id=? AND s.member_id=? AND '+active,subscription,memberId,sessionHash,memberId,now);
 return !!row;
}
