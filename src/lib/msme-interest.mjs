import {parseCalendarDate} from './interest.mjs';
const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
export function msmeDueDate(acceptance,terms){
 const a=parseCalendarDate(acceptance);
 if(acceptance<'2006-10-02')throw new Error('Acceptance predates commencement of the Act.');
 if(terms!==null&&(!Number.isInteger(terms)||terms<0||terms>45))throw new Error('Written payment period must be 0–45 days.');
 const due=a+(terms===null?15:terms)*DAY;
 return {due:iso(due),defaultDate:iso(due+DAY)};
}
function rest(start,index){
 const d=new Date(start),y=d.getUTCFullYear(),m=d.getUTCMonth()+index;
 return Date.UTC(y,m,Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()));
}
export function msmeEstimate(invoices,rates,asOf){
 const end=parseCalendarDate(asOf);
 if(!invoices.length||invoices.length>100||rates.length>200)throw new Error('Use 1–100 invoices and at most 200 rate periods.');
 const periods=rates.map(r=>{
  const from=parseCalendarDate(r.from),to=parseCalendarDate(r.to);
  if(to<=from||!Number.isFinite(r.rate)||r.rate<0||r.rate>30||!r.source?.trim())throw new Error('Invalid rate period or missing source reference.');
  return {...r,from,to};
 }).sort((a,b)=>a.from-b.from);
 for(let i=1;i<periods.length;i++)if(periods[i].from<periods[i-1].to)throw new Error('Rate periods overlap.');
 const ids=new Set();
 const rows=invoices.map(inv=>{
  const id=inv.id.trim();
  if(!id||id.length>80||ids.has(id))throw new Error('Invoice references must be unique and nonempty.');
  ids.add(id);
  if(!Number.isFinite(inv.amount)||inv.amount<=0||inv.amount>1e12)throw new Error('Invalid principal for '+id);
  if(end<parseCalendarDate(inv.acceptance))throw new Error('Calculation date precedes acceptance: '+id);
  const dates=msmeDueDate(inv.acceptance,inv.terms),start=parseCalendarDate(dates.defaultDate);
  if(end-start>36525*DAY)throw new Error('Maximum interest duration is 100 years.');
  const payments=(inv.payments??[]).map((p,index)=>{
   const at=parseCalendarDate(p.date);
   if(at<parseCalendarDate(inv.acceptance)||at>end)throw new Error('Payment date outside invoice period: '+id);
   if(!Number.isFinite(p.amount)||p.amount<=0||p.amount>1e12)throw new Error('Invalid payment amount: '+id);
   if(!['principal-only','interest-first','principal-first','interest-only'].includes(p.mode))throw new Error('Select payment appropriation: '+id);
   return {...p,at,index};
  }).sort((a,b)=>a.at-b.at||a.index-b.index);
  if(payments.length>200)throw new Error('Maximum 200 payments per invoice.');
  let cursor=start,i=0,k=1,principal=inv.amount,capitalized=0,accrued=0,pi=0,principalPaid=0,interestPaid=0,interestEarned=0;
  const allocations=[],ledger=[];
  const takePrincipal=amount=>{const used=Math.min(principal,amount);principal-=used;principalPaid+=used;return used};
  const takeInterest=amount=>{const unposted=Math.min(accrued,amount);accrued-=unposted;const posted=Math.min(capitalized,amount-unposted);capitalized-=posted;interestPaid+=unposted+posted;return unposted+posted};
  function apply(at){
   while(pi<payments.length&&payments[pi].at<=at){
    const p=payments[pi++];let pp=0,ip=0;
    if(p.mode==='interest-first'||p.mode==='interest-only'){ip=takeInterest(p.amount);if(p.mode==='interest-first')pp=takePrincipal(p.amount-ip)}
    else{pp=takePrincipal(p.amount);if(p.mode==='principal-first')ip=takeInterest(p.amount-pp)}
    if(p.amount-pp-ip>0.000001)throw new Error('Payment exceeds selected available balance for '+id+' on '+p.date+'. Check allocation and dates.');
    allocations.push({date:p.date,amount:p.amount,mode:p.mode,principal:pp,interest:ip,principalRemaining:principal,interestRemaining:capitalized+accrued});
   }
  }
  apply(Math.min(start,end));
  while(cursor<end){
   while(i<periods.length&&periods[i].to<=cursor)i++;
   if(principal===0&&capitalized===0&&accrued===0){apply(end);break}
   const p=periods[i];
   if(!p||p.from>cursor)throw new Error('Missing bank-rate coverage from '+iso(cursor)+' for '+id);
   const next=rest(start,k),stop=Math.min(end,p.to,next,payments[pi]?.at??Infinity);
   const opening=principal+capitalized,earned=opening*3*p.rate/100*(stop-cursor)/DAY/365;
   accrued+=earned;interestEarned+=earned;
   ledger.push({from:iso(cursor),to:iso(stop),days:(stop-cursor)/DAY,bankRate:p.rate,opening,earned,rest:stop===next});
   cursor=stop;
   if(cursor===next){capitalized+=accrued;accrued=0;k++}
   apply(cursor);
   if(!Number.isFinite(principal+capitalized+accrued)||principal+capitalized+accrued>1e14)throw new Error('Result exceeds supported range.');
  }
  apply(end);
  const interest=capitalized+accrued;
  return {id,amount:inv.amount,acceptance:inv.acceptance,terms:inv.terms,...dates,days:Math.max(0,(end-start)/DAY),principal,principalPaid,interestPaid,interestEarned,interest,total:principal+interest,allocations,ledger};
 });
 const totals=rows.reduce((a,r)=>({original:a.original+r.amount,principal:a.principal+r.principal,principalPaid:a.principalPaid+r.principalPaid,interestPaid:a.interestPaid+r.interestPaid,interestEarned:a.interestEarned+r.interestEarned,interest:a.interest+r.interest,total:a.total+r.total}),{original:0,principal:0,principalPaid:0,interestPaid:0,interestEarned:0,interest:0,total:0});
 if(totals.total>1e14)throw new Error('Combined result exceeds supported range.');
 return {rows,totals,asOf};
}
