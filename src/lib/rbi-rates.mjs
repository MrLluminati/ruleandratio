import {parseCalendarDate} from './interest.mjs';
export function historicalRatePeriods(data,start,end){
 const s=parseCalendarDate(start),e=parseCalendarDate(end);
 if(e<s)throw new Error('Invalid historical rate interval.');
 if(s<parseCalendarDate(data.coverageStart)||e>parseCalendarDate(data.endExclusive))throw new Error('Outside recorded RBI rate coverage. Use verified manual rate periods.');
 if(s===e)return [];
 const changes=data.changes;
 const result=[];
 for(let i=0;i<changes.length;i++){
  const c=changes[i],from=parseCalendarDate(c.from),to=parseCalendarDate(changes[i+1]?.from??data.endExclusive);
  if(to<=from||!Number.isFinite(c.rate)||!data.sources[c.source])throw new Error('Invalid historical rate record.');
  const a=Math.max(from,s),b=Math.min(to,e);
  if(a<b){const source=data.sources[c.source];result.push({from:new Date(a).toISOString().slice(0,10),to:new Date(b).toISOString().slice(0,10),rate:c.rate,source:source.title+' — '+source.url,url:source.url})}
 }
 if(!result.length||result[0].from!==start||result.at(-1).to!==end||result.some((r,i)=>i>0&&r.from!==result[i-1].to))throw new Error('Historical rate coverage gap.');
 return result;
}
