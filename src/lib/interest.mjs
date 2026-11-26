// General arithmetic only: not a statutory or contractual entitlement calculator.
export const frequencies=[1,2,4,12];
const DAY=86400000;
export function parseCalendarDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Enter valid dates.');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value||value<'1900-01-01'||value>'2200-12-31')throw new Error('Dates must be valid and between 1900 and 2200.');
 return date.getTime();
}
export function elapsedDays(start,end){
 const days=(parseCalendarDate(end)-parseCalendarDate(start))/DAY;
 if(days<0)throw new Error('End date must not precede the start date.');
 return days;
}
export function interestEstimate({principal,rate,days,method='simple',frequency=12}){
 if(!Number.isFinite(principal)||principal<=0||principal>1e12)throw new Error('Principal must be greater than zero and at most ₹1 lakh crore.');
 if(!Number.isFinite(rate)||rate<0||rate>1000)throw new Error('Annual rate must be between 0 and 1,000%.');
 if(!Number.isInteger(days)||days<0||days>110000)throw new Error('Enter a valid duration.');
 if(!['simple','compound'].includes(method))throw new Error('Unknown interest method.');
 if(method==='compound'&&!frequencies.includes(frequency))throw new Error('Select a supported compounding frequency.');
 const years=days/365,r=rate/100;
 const interest=method==='simple'?principal*r*years:principal*Math.expm1(frequency*years*Math.log1p(r/frequency));
 const total=principal+interest;
 if(!Number.isFinite(total)||total>1e14)throw new Error('Result exceeds the supported numerical range. Reduce the inputs.');
 return {principal,rate,days,years,method,frequency,interest,total};
}
