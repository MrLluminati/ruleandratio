import {areas} from './areas';
export const hubGroups=[
 {title:'Public law and governance',slugs:['constitutional-law','administrative-law','service-law','human-rights','election-law','international-law','environmental-law']},
 {title:'Disputes and procedure',slugs:['criminal-law','civil-procedure','arbitration','commercial-law','msme-law','consumer-protection']},
 {title:'Business and regulation',slugs:['corporate-law','banking-finance','insolvency','taxation','competition-law','insurance-law','intellectual-property','technology-law']},
 {title:'People, property and institutions',slugs:['property-rera','family-law','labour-employment','education-law','health-law','trusts-societies','legal-ethics','general']},
];
export const hubPath=(slug:string)=>'/areas-of-law/'+slug+'/';
export const hubTopics:Record<string,string[]>={
 'constitutional-law':['Fundamental rights','Constitutional remedies','Federalism','Judicial review','Constitutional amendments'],
 'criminal-law':['Substantive offences','Criminal procedure','Evidence','Bail','Trial and appeal'],
 'civil-procedure':['Jurisdiction','Pleadings','Interim relief','Trial','Appeals and execution'],
 'arbitration':['Arbitration agreements','Appointment and jurisdiction','Arbitral proceedings','Challenge to awards','Enforcement'],
 'msme-law':['Registration and eligibility','Payment obligations','Interest','MSEFC references','Awards and enforcement'],
 'commercial-law':['Contracts','Commercial courts','Recovery proceedings','Interim remedies','Enforcement'],
 'property-rera':['Property transfers','Title and registration','Real estate regulation','Disputes and remedies'],
 'consumer-protection':['Consumer rights','Complaints','Jurisdiction','Remedies and appeals'],
 'corporate-law':['Company formation','Governance','Compliance','Corporate disputes'],
 'labour-employment':['Employment terms','Wages','Social security','Industrial disputes'],
 'family-law':['Marriage','Maintenance','Guardianship','Succession'],
 'taxation':['Direct taxation','Indirect taxation','Assessment','Appeals'],
};
export function assertHubGroups(){const grouped=hubGroups.flatMap(g=>g.slugs);if(new Set(grouped).size!==grouped.length || areas.some(a=>!grouped.includes(a.slug)) || grouped.some(s=>!areas.some(a=>a.slug===s)))throw new Error('Invalid hub grouping')}
assertHubGroups();
