// Bihar Stamp Manual, pp. 37–44, 46. Schedule amounts only; not a certified payable fee.
export const feeSources={manual:'https://cdnbbsr.s3waas.gov.in/s3ec045421e013565f7f1afa0cfe8ad87a/uploads/2023/12/2023123122-1.pdf',repeal:'https://indiankanoon.org/doc/15127114/',repealedScale:'https://vidhansabha.bihar.gov.in/pdf/enected%20bill/gudget2008/04-08.pdf',surcharge:'https://indiankanoon.org/doc/155033780/',writ:'https://indiankanoon.org/doc/77786992/',suitExample:'https://indiankanoon.org/doc/188714780/',capExample:'https://indiankanoon.org/doc/36555293/'};
export const fixedFees=[
 {id:'writ226',label:'Patna High Court — Article 226 petition',fee:250,authority:'Schedule II, Article 1(d)(i); see M/s Laxman Kumar, 24 July 2025'},
 {id:'writ227',label:'Patna High Court — Article 227 petition',fee:250,authority:'Schedule II, Article 1(d)(ii), manual p. 46'},
 {id:'joint-writ',label:'Patna High Court — Articles 226 and 227 jointly',fee:500,authority:'Schedule II, Article 1(d)(iii), manual p. 46'},
 {id:'misc-petition',label:'Patna High Court — miscellaneous petition (where this entry applies)',fee:20,authority:'Schedule II, Article 1(d)(iv), manual p. 46'}
];
export const bands=[
 {lower:5,upper:100,anchor:0,base:0,step:5,increment:1},
 {lower:100,upper:1000,anchor:100,base:20,step:10,increment:2},
 {lower:1000,upper:5000,anchor:1000,base:200,step:100,increment:16},
 {lower:5000,upper:10000,anchor:5000,base:840,step:250,increment:32},
 {lower:10000,upper:20000,anchor:10000,base:1480,step:500,increment:48},
 {lower:20000,upper:30000,anchor:20000,base:2440,step:1000,increment:64},
 {lower:30000,upper:50000,anchor:30000,base:3080,step:2000,increment:64},
 {lower:50000,upper:2940000,anchor:50000,base:3720,step:5000,increment:80}
];
export function courtFeeEstimate({state='bihar',type='money-suit',valuation,surcharge=false}={}){
 if(state!=='bihar')throw Error('Only Bihar has a configured reference schedule.');
 const fixed=fixedFees.find(x=>x.id===type);
 let baseFee,alternate=null,authority,explanation,warning='';
 if(fixed){baseFee=fixed.fee;authority=fixed.authority;explanation='Single fee-bearing petition under the selected schedule entry. Multiplicity, exemptions and classification are not assessed.'}
 else if(type==='money-suit'){
  if(!Number.isFinite(valuation)||valuation<=5||valuation>1e12)throw Error('Enter a verified money-suit valuation above ₹5 and up to ₹1 lakh crore. Small claims and other reliefs require manual review.');
  authority='Schedule I, Article 1 — Bihar Stamp Manual, pp. 37–44';
  if(valuation>2940000){baseFee=50000;explanation='Manual expressly specifies ₹50,000 for values exceeding ₹29,40,000.'}
  else{
   const b=bands.find(b=>valuation>b.lower&&valuation<=b.upper);
   const n=Math.ceil((valuation-b.anchor)/b.step);
   baseFee=b.base+n*b.increment;
   explanation='₹'+b.base+' + '+n+' × ₹'+b.increment+' (each ₹'+b.step+' or part thereof above ₹'+b.anchor+').';
   if(valuation>205000){alternate=baseFee+2;warning='The manual’s higher-value worked examples are ₹2 above the continuation from ₹2,05,000. Both readings are shown as scenarios; obtain the taxing office determination. Neither is certified.'}
  }
  warning+=(warning?' ':'')+'Uses the printed table, not the repealed 2007 scale. The original prose and printed table are not fully reconciled; verify the applicable schedule and valuation.';
 }else throw Error('Proceeding not supported. Verify the appropriate fee provision manually.');
 const surchargeAmount=surcharge?baseFee/10:0;
 return {state,type,valuation:type==='money-suit'?valuation:null,baseFee,alternate,authority,explanation,warning,surcharge,surchargeAmount,scenarioTotal:baseFee+surchargeAmount,alternateTotal:alternate===null?null:alternate*(surcharge?1.1:1)};
}
