import {parseCalendarDate} from './interest.mjs';
export function stampDutyEstimate(data,{state='bihar',instrument,transfer,date,consideration=0,mvr,registrationBase,confirmed=false}={}){
 if(state!=='bihar')throw Error('Only Bihar is configured.');
 if(!['sale','gift'].includes(instrument))throw Error('Only ordinary sale and gift deeds are supported.');
 if(!confirmed)throw Error('Confirm the valuation and rate assumptions before calculating.');
 parseCalendarDate(date);
 if(date<data.scenarioFrom||date>data.scenarioThrough)throw Error('Outside the June 2026 reference scenario. Obtain applicable rates separately.');
 const rate=data.rates.find(r=>r.id===transfer);
 if(!rate)throw Error('Select a verified transfer classification.');
 const check=(v,name,zero=false)=>{if(!Number.isFinite(v)||v<(zero?0:0.01)||v>1e12||Math.abs(v*100-Math.round(v*100))>0.01)throw Error('Enter a valid '+name+' in rupees, up to two decimals.');return Math.round(v*100)};
 const m=check(mvr,'assessed property value'),c=instrument==='sale'?check(consideration,'sale consideration'):0;
 const base=Math.max(c,m),rb=registrationBase===undefined||registrationBase===null?base:check(registrationBase,'verified registration fee base');
 const stamp=Math.round(base*rate.stampBps/10000),registration=Math.round(rb*rate.registrationBps/10000);
 return {instrument,transfer:rate.label,date,consideration:c/100,mvr:m/100,base:base/100,registrationBase:rb/100,stampRate:rate.stampBps/100,registrationRate:rate.registrationBps/100,stamp:stamp/100,registration:registration/100,total:(stamp+registration)/100,article:instrument==='sale'?'Schedule IA, Article 23 (sale deed)':'Schedule IA, Article 33 (gift deed)',version:data.version};
}
