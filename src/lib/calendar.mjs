import {parseCalendarDate,elapsedDays} from './interest.mjs';
const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
function bounded(t){
 if(!Number.isFinite(t)||t<Date.UTC(1900,0,1)||t>Date.UTC(2200,11,31))throw new Error('Result must be between 1900 and 2200.');
 return iso(t);
}
function integer(n,max,label){if(!Number.isInteger(n)||n<0||n>max)throw new Error(label+' must be a non-negative whole number, at most '+max+'.');return n}
function monthShift(t,months){
 const d=new Date(t),y=d.getUTCFullYear(),m=d.getUTCMonth()+months;
 return Date.UTC(y,m,Math.min(d.getUTCDate(),new Date(Date.UTC(y,m+1,0)).getUTCDate()));
}
export function shiftCalendarDate(start,{years=0,months=0,weeks=0,days=0,direction='add'}={}){
 const t=parseCalendarDate(start);
 integer(years,300,'Years');integer(months,3600,'Months');integer(weeks,16000,'Weeks');integer(days,110000,'Days');
 if(!['add','subtract'].includes(direction))throw new Error('Select add or subtract.');
 const sign=direction==='add'?1:-1;
 const calendar=monthShift(t,sign*(years*12+months));
 bounded(calendar);
 const result=bounded(calendar+sign*(weeks*7+days)*DAY);
 return {start,result,direction,years,months,weeks,days,elapsed:Math.abs(parseCalendarDate(result)-t)/DAY,weekday:weekday(result)};
}
export function weekday(value){return new Intl.DateTimeFormat('en-IN',{weekday:'long',timeZone:'UTC'}).format(new Date(parseCalendarDate(value)))}
export function dateDuration(start,end){
 const a=parseCalendarDate(start),b=parseCalendarDate(end),days=elapsedDays(start,end);
 const x=new Date(a),y=new Date(b);
 let months=(y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth();
 if(monthShift(a,months)>b)months--;
 const remainder=(b-monthShift(a,months))/DAY;
 return {start,end,days,inclusiveDays:days+1,weeks:Math.floor(days/7),weekRemainder:days%7,years:Math.floor(months/12),months:months%12,calendarRemainder:remainder,startWeekday:weekday(start),endWeekday:weekday(end)};
}
