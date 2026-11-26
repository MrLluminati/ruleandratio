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
  let cursor=start,i=0,k=1,balance=inv.amount,accrued=0;
  while(cursor<end){
   while(i<periods.length&&periods[i].to<=cursor)i++;
   const p=periods[i];
   if(!p||p.from>cursor)throw new Error('Missing bank-rate coverage from '+iso(cursor)+' for '+id);
   const next=rest(start,k),stop=Math.min(end,p.to,next);
   accrued+=balance*3*p.rate/100*(stop-cursor)/DAY/365;
   cursor=stop;
   if(cursor===next){balance+=accrued;accrued=0;k++}
   if(!Number.isFinite(balance+accrued)||balance+accrued>1e14)throw new Error('Result exceeds supported range.');
  }
  const interest=balance-inv.amount+accrued;
  return {id,amount:inv.amount,acceptance:inv.acceptance,terms:inv.terms,...dates,days:Math.max(0,(end-start)/DAY),interest,total:inv.amount+interest};
 });
 const totals=rows.reduce((a,r)=>({principal:a.principal+r.amount,interest:a.interest+r.interest,total:a.total+r.total}),{principal:0,interest:0,total:0});
 if(totals.total>1e14)throw new Error('Combined result exceeds supported range.');
 return {rows,totals,asOf};
}
