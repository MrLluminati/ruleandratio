import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {z} from 'astro/zod';
import {areas} from './data/areas';
import {types,slugPattern} from './data/publication';
import {digestPeriod} from './lib/digests.mjs';
import {newsKinds} from './lib/news.mjs';

const nonempty=z.string().trim().min(1);
const url=z.string().url().refine(value=>/^https?:\/\//i.test(value),'Only HTTP(S) source links are allowed');
const date=z.coerce.date();
const source=z.object({title:nonempty,url,kind:z.enum(['primary','secondary']),pinpoint:nonempty.optional()});
const treatmentTypes=['cited','followed','relied-on','distinguished','explained','approved','overruled','partly-overruled','doubted','referred-to-larger-bench'] as const;
const treatment=z.object({
 relation:z.enum(treatmentTypes),targetCase:nonempty,targetSlug:z.string().regex(slugPattern).optional(),
 targetUrl:url.optional(),targetDecisionDate:date.optional(),issue:nonempty,pinpoint:nonempty,explanation:nonempty,
}).superRefine((r,ctx)=>{
 if(!r.targetSlug&&!r.targetUrl)ctx.addIssue({code:'custom',message:'Provide an internal case slug or external judgment URL',path:['targetSlug']});
 if(!r.targetSlug&&!r.targetDecisionDate)ctx.addIssue({code:'custom',message:'External target requires verified decision date',path:['targetDecisionDate']});
});
const judgment=z.object({
 caseName:nonempty,court:nonempty,decisionDate:date,
 citation:nonempty.optional(),equivalentCitations:z.array(nonempty).default([]),caseNumber:nonempty.optional(),
 bench:z.array(nonempty).optional(),benchStrength:z.number().int().positive().optional(),disposition:nonempty.optional(),
 decisionKind:z.enum(['judgment','order','reference-order','interim-order']).optional(),
 treatments:z.array(treatment).default([]),
 judgmentUrl:url,
}).refine(d=>Boolean(d.citation || d.caseNumber || d.equivalentCitations.length),'Provide a verified citation or case number');
const news=z.object({
 kind:nonempty.refine(k=>Object.hasOwn(newsKinds,k),'Unknown news development type'),
 eventDate:date,authority:nonempty,identifier:nonempty,primaryUrl:url,
 verification:z.enum(['pending','verified']).default('pending'),
 digest:z.object({frequency:z.enum(['daily','weekly']),start:date,end:date,reportSlugs:z.array(z.string().regex(slugPattern)).min(1)}).optional(),
 corrections:z.array(z.object({date,summary:nonempty})).default([]),
});
const articles=defineCollection({
 loader:glob({base:'./src/content/articles',pattern:'**/*.md'}),
 schema:z.object({
 title:nonempty,description:nonempty,
 slug:z.string().regex(slugPattern).optional(),
 type:z.enum(types),
 areas:z.array(nonempty.refine(v=>areas.some(a=>a.slug===v),'Unknown area of law')).min(1),
 jurisdiction:nonempty,
 author:nonempty,authorType:z.enum(['Person','Organization']).default('Person'),reviewer:nonempty.optional(),
 publishedAt:date.optional(),reviewedAt:date.optional(),modifiedAt:date.optional(),
 sources:z.array(source).default([]),
 judgment:judgment.optional(),
 news:news.optional(),
 statuteRefs:z.array(z.object({act:z.string().regex(slugPattern),provision:z.string().regex(slugPattern).optional()})).default([]),
 draft:z.boolean().default(true),
 }).superRefine((data,ctx)=>{
 const fail=(message:string,path:string[])=>ctx.addIssue({code:'custom',message,path});
 if(data.draft)return;
 if(!data.slug)fail('Published content requires a stable slug',['slug']);
 if(!data.reviewer)fail('Human reviewer is required',['reviewer']);
 if(!data.publishedAt || !data.reviewedAt)fail('Publication and review dates are required',['publishedAt']);
 const now=Date.now();
 if(data.publishedAt && data.publishedAt.getTime()>now)fail('Future publication dates are not allowed',['publishedAt']);
 if(data.reviewedAt && data.reviewedAt.getTime()>now)fail('Future review dates are not allowed',['reviewedAt']);
 if(data.modifiedAt && (data.modifiedAt.getTime()>now || (data.publishedAt && data.modifiedAt<data.publishedAt)))fail('Invalid substantive modification date',['modifiedAt']);
 if(!data.sources.some(s=>s.kind==='primary'))fail('At least one primary source is required',['sources']);
 if(data.type==='news'){
  if(data.slug==='digests')fail('Reserved news archive slug',['slug']);
  const n=data.news;
  if(!n)fail('News publication requires event metadata',['news']);
  else {
   if(n.kind==='digest'){
    if(!n.digest)fail('Digest requires coverage and report metadata',['news','digest']);
    else {try{digestPeriod(n.digest.frequency,n.digest.start,n.digest.end)}catch(e){fail(e instanceof Error?e.message:'Invalid digest period',['news','digest'])}}
   }else if(n.digest)fail('Digest metadata is reserved for digest entries',['news','digest']);
   if(n.verification!=='verified')fail('News must be verified before publication',['news','verification']);
   if(data.publishedAt&&n.eventDate>data.publishedAt)fail('Event date cannot follow publication',['news','eventDate']);
   if(data.reviewedAt&&n.eventDate>data.reviewedAt)fail('Review cannot predate the event',['reviewedAt']);
   if(!data.sources.some(s=>s.kind==='primary'&&s.url===n.primaryUrl&&s.pinpoint))fail('Include exact primary document and pinpoint',['sources']);
   for(const c of n.corrections)if(c.date.getTime()>now||!data.modifiedAt||c.date>data.modifiedAt||data.publishedAt&&c.date<data.publishedAt)fail('Correction requires valid dated modification',['news','corrections']);
  }
 }else if(data.news)fail('News metadata is reserved for news entries',['news']);
 if(data.type==='judgment'){
  if(!data.judgment)fail('Judgment metadata is required',['judgment']);
  else {
   const j=data.judgment;
   if(j.benchStrength&&j.bench?.length&&j.benchStrength!==j.bench.length)fail('Bench strength does not match listed coram',['judgment','benchStrength']);
   const citations=[j.citation,...j.equivalentCitations].filter(Boolean).map(v=>v!.trim().toLowerCase());
   if(new Set(citations).size!==citations.length)fail('Duplicate judgment citation',['judgment','equivalentCitations']);
   const relationships=new Set<string>();
   for(const r of j.treatments){
    if(r.targetSlug===data.slug)fail('Self-referential treatment',['judgment','treatments']);
    if(r.targetDecisionDate&&r.targetDecisionDate>j.decisionDate)fail('Treatment cannot predate its target',['judgment','treatments']);
    const key=JSON.stringify([r.targetSlug??r.targetUrl,r.relation,r.issue.toLowerCase(),r.pinpoint]);
    if(relationships.has(key))fail('Duplicate judicial relationship',['judgment','treatments']);
    relationships.add(key);
   }
   if(data.publishedAt && data.judgment.decisionDate>data.publishedAt)fail('Decision date cannot follow publication',['judgment','decisionDate']);
   if(!data.sources.some(s=>s.kind==='primary' && s.url===data.judgment?.judgmentUrl))fail('Include the judgment text URL as a primary source',['sources']);
  }
 }else if(data.judgment)fail('Judgment metadata is reserved for judgment entries',['judgment']);
 }),
});
export const collections={articles};
