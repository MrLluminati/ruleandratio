import {shiftCalendarDate,weekday} from './calendar.mjs';
import {parseCalendarDate,elapsedDays} from './interest.mjs';
const add=(d,offset)=>shiftCalendarDate(d,offset).result;
export function section34Estimate({receipt,mode='receipt',requestDate='',disposal='',notice=false,formal=false,excluded=0,exclusionBasis='',closureDate='',reopening='',closureBasis='',filing=''}){
 parseCalendarDate(receipt);
 if(receipt<'1996-08-22')throw new Error('Award receipt predates commencement of the 1996 Act.');
 if(!['receipt','section33'].includes(mode))throw new Error('Select a triggering event.');
 let trigger=receipt;
 if(mode==='section33'){
  if(!formal||!notice)throw new Error('Confirm formal Section 33 proceedings and notice to the other party.');
  if(!requestDate||!disposal)throw new Error('Enter the request and disposal dates.');
  if(elapsedDays(receipt,requestDate)>30)throw new Error('Request exceeds the standard 30-day period. Agreed alternate periods and successive requests require separate legal review.');
  elapsedDays(requestDate,disposal);
  trigger=disposal;
 }
 if(!Number.isInteger(excluded)||excluded<0||excluded>110000)throw new Error('Enter a valid count of independently verified excluded days.');
 if(excluded&&!exclusionBasis.trim())throw new Error('Provide the legal basis for excluded days.');
 const raw=add(trigger,{months:3});
 const ordinary=add(raw,{days:excluded});
 const outer=add(ordinary,{days:30});
 let reopeningDay=null;
 if(closureDate||reopening||closureBasis){
  if(closureDate!==ordinary||!reopening||!closureBasis.trim())throw new Error('Court closure must match the ordinary deadline '+ordinary+'; provide first reopening and authority.');
  if(elapsedDays(ordinary,reopening)<1)throw new Error('Reopening must follow ordinary expiry.');
  reopeningDay=reopening;
 }
 const timelyThrough=reopeningDay??ordinary;
 let status='Not compared',delay=null;
 if(filing){
  if(parseCalendarDate(filing)<parseCalendarDate(trigger))throw new Error('Filing precedes the selected trigger.');
  delay=(parseCalendarDate(filing)-parseCalendarDate(ordinary))/86400000;
  status=filing<=timelyThrough?'Within ordinary period or verified Section 4 reopening':filing<=outer?'Within conditional 30-day window — sufficient cause required':'Beyond modeled windows — urgent independent legal review';
 }
 return {receipt,trigger,mode,requestDate:mode==='section33'?requestDate:'',disposal:mode==='section33'?disposal:'',raw,ordinary,outer,timelyThrough,reopeningDay,excluded,exclusionBasis,closureBasis,filing,status,delay,ordinaryWeekday:weekday(ordinary),outerWeekday:weekday(outer),receiptOnlyOrdinary:add(receipt,{months:3}),historicalWarning:trigger<='2022-02-28'&&outer>='2020-03-15'};
}
