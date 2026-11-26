// Spreadsheet-compatible plain CSV, not an XLSX workbook. Neutralize formula-like text.
export function csvCell(value){
 if(typeof value==='number')return Number.isFinite(value)?String(value):'';
 let text=String(value??'');
 if(/^[\s\uFEFF]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function msmeCsv(report,rates,mode){
 const f=n=>Number(n.toFixed(2));
 const lines=[
 ['Rule & Ratio — MSME interest estimate (beta)'],
 ['As of (interest end excluded; payments included)',report.asOf],['Rate mode',mode],
 ['Assumptions','Actual/365; monthly anniversary rests; payment date start after rest; entered allocation order; unposted interest paid before capitalized interest; no legal certification.'],
 ['Invoice','Acceptance','Terms days (blank = none)','Due','Default','Original principal','Principal paid','Principal outstanding','Interest accrued','Interest paid','Interest outstanding','Total outstanding'],
 ...report.rows.map(r=>[r.id,r.acceptance,r.terms,r.due,r.defaultDate,f(r.amount),f(r.principalPaid),f(r.principal),f(r.interestEarned),f(r.interestPaid),f(r.interest),f(r.total)]),
 ['Totals','','','','',f(report.totals.original),f(report.totals.principalPaid),f(report.totals.principal),f(report.totals.interestEarned),f(report.totals.interestPaid),f(report.totals.interest),f(report.totals.total)],
 [],['Payment allocations'],['Invoice','Date','Payment','Mode','Principal applied','Interest applied','Principal remaining','Interest remaining'],
 ...report.rows.flatMap(r=>r.allocations.map(p=>[r.id,p.date,f(p.amount),p.mode,f(p.principal),f(p.interest),f(p.principalRemaining),f(p.interestRemaining)])),
 [],['Rate inputs'],['From','To (exclusive)','Bank rate %','Source'],...rates.map(r=>[r.from,r.to,r.rate,r.source]),
 [],['Accrual intervals (rounded display only; totals calculated before rounding)'],['Invoice','From','To (exclusive)','Days','Bank rate %','Accrual base','Interest earned','Monthly rest'],
 ...report.rows.flatMap(r=>r.ledger.map(l=>[r.id,l.from,l.to,l.days,l.bankRate,f(l.opening),f(l.earned),l.rest?'Yes':'No']))
 ];
 return '\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
