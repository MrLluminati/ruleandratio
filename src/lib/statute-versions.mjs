export function indiaDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=t=>parts.find(p=>p.type===t)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
export function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function versionStatus(version,date){
 if(!validDate(date)||!version.effectiveFrom)return 'undated';
 if(date<version.effectiveFrom)return 'future';
 if(version.effectiveUntil&&date>=version.effectiveUntil)return 'historical';
 return 'date-match';
}
export const versionLabels={'undated':'Effective date not recorded','future':'After selected date','historical':'Ended before or on selected date','date-match':'Matches recorded date interval'};
export function matchingVersions(versions,date){
 return validDate(date)?versions.filter(v=>versionStatus(v,date)==='date-match'):[];
}
export function matchesQuery(value,query){
 const normalize=s=>String(s??'').toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g,' ').trim();
 const hay=normalize(value);
 return normalize(query).split(/\s+/).filter(Boolean).every(token=>hay.includes(token));
}
