import {shiftCalendarDate,weekday} from './calendar.mjs';
import {parseCalendarDate} from './interest.mjs';
export const limitationSource='https://www.indiacode.nic.in/bitstream/123456789/1565/5/A1963-36.pdf';
export const presets=[
 {id:'54',label:'Article 54 — Specific performance',period:3,unit:'years',trigger:'Fixed performance date; otherwise date of notice of refusal.',condonation:'Section 5 does not apply to suits.'},
 {id:'55',label:'Article 55 — Contract breach compensation (residual)',period:3,unit:'years',trigger:'Relevant breach date; for a continuing breach, its cessation.',condonation:'Section 5 does not apply to suits.'},
 {id:'116a',label:'Article 116(a) — CPC appeal to High Court',period:90,unit:'days',trigger:'Date of decree or order.',condonation:'Section 5 may apply on sufficient cause; no fixed automatic extension.'},
 {id:'116b',label:'Article 116(b) — CPC appeal to another court',period:30,unit:'days',trigger:'Date of decree or order.',condonation:'Section 5 may apply on sufficient cause; no fixed automatic extension.'},
 {id:'117',label:'Article 117 — Appeal within same High Court',period:30,unit:'days',trigger:'Date of decree or order.',condonation:'Check applicable appeal and court rules; Section 5 may apply.'},
 {id:'124',label:'Article 124 — Review (other than Supreme Court)',period:30,unit:'days',trigger:'Date of decree or order.',condonation:'Section 5 may apply on sufficient cause.'},
 {id:'136',label:'Article 136 — Execution of ordinary civil decree/order',period:12,unit:'years',trigger:'Enforceability date, or relevant default for scheduled payment/delivery. Excludes mandatory and perpetual injunctions.',condonation:'Section 5 excludes applications under Order XXI CPC.'},
 {id:'137',label:'Article 137 — Residual application',period:3,unit:'years',trigger:'Date right to apply accrues; only if no other applicable period.',condonation:'Check applicability of Section 5, including forum and exclusions.'}
];
const DAY=86400000;
export function limitationEstimate({preset='custom',trigger,period,unit,excluded=0,exclusionBasis='',closureDate='',reopening='',closureBasis='',comparison=''}){
 const start=parseCalendarDate(trigger);
 const rule=presets.find(p=>p.id===preset);
 if(preset!=='custom'&&!rule)throw new Error('Unknown proceeding.');
 if(rule){period=rule.period;unit=rule.unit}
 if(!['days','months','years'].includes(unit)||!Number.isInteger(period)||period<1)throw new Error('Enter a positive whole-number period and unit.');
 if(!Number.isInteger(excluded)||excluded<0||excluded>110000)throw new Error('Enter a valid count of additional excluded days.');
 if(excluded&&!exclusionBasis.trim())throw new Error('Provide the legal basis for additional excluded days.');
 const base=shiftCalendarDate(trigger,{[unit]:period}).result;
 const adjusted=shiftCalendarDate(base,{days:excluded}).result;
 let deadline=adjusted;
 if(closureDate||reopening||closureBasis){
  if(!closureDate||!reopening||!closureBasis.trim())throw new Error('Provide closure date, reopening date and applicable legal basis together.');
  if(closureDate!==adjusted)throw new Error('Verified closure date must match the adjusted ordinary deadline: '+adjusted);
  if(parseCalendarDate(reopening)<=parseCalendarDate(adjusted))throw new Error('Reopening must follow the closure date.');
  deadline=reopening;
 }
 const delta=comparison?(parseCalendarDate(comparison)-parseCalendarDate(deadline))/DAY:null;
 if(comparison&&parseCalendarDate(comparison)<start)throw new Error('Comparison date precedes triggering date.');
 return {rule:rule?.label??'Custom period (user verified)',trigger,period,unit,excluded,exclusionBasis,base,adjusted,closureDate,reopening,closureBasis,deadline,weekday:weekday(deadline),comparison,delta,condonation:rule?.condonation??'Verify whether condonation is available under the applicable law; no automatic extension.',historicalWarning:trigger<='2022-02-28'&&deadline>='2020-03-15'};
}
