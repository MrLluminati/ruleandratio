import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {z} from 'astro/zod';
import {areas} from './data/areas';
import {types,slugPattern} from './data/publication';

const nonempty=z.string().trim().min(1);
const url=z.string().url().refine(value=>/^https?:\/\//i.test(value),'Only HTTP(S) source links are allowed');
const date=z.coerce.date();
const source=z.object({title:nonempty,url,kind:z.enum(['primary','secondary']),pinpoint:nonempty.optional()});
const judgment=z.object({
 caseName:nonempty,court:nonempty,decisionDate:date,
 citation:nonempty.optional(),caseNumber:nonempty.optional(),
 bench:z.array(nonempty).optional(),disposition:nonempty.optional(),
 judgmentUrl:url,
}).refine(d=>Boolean(d.citation || d.caseNumber),'Provide a verified citation or case number');
const articles=defineCollection({
 loader:glob({base:'./src/content/articles',pattern:'**/*.md'}),
 schema:z.object({
 title:nonempty,description:nonempty,
 slug:z.string().regex(slugPattern).optional(),
 type:z.enum(types),
 areas:z.array(nonempty.refine(v=>areas.some(a=>a.slug===v),'Unknown area of law')).min(1),
 jurisdiction:nonempty,
 author:nonempty,reviewer:nonempty.optional(),
 publishedAt:date.optional(),reviewedAt:date.optional(),
 sources:z.array(source).default([]),
 judgment:judgment.optional(),
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
 if(!data.sources.some(s=>s.kind==='primary'))fail('At least one primary source is required',['sources']);
 if(data.type==='judgment'){
  if(!data.judgment)fail('Judgment metadata is required',['judgment']);
  else {
   if(data.publishedAt && data.judgment.decisionDate>data.publishedAt)fail('Decision date cannot follow publication',['judgment','decisionDate']);
   if(!data.sources.some(s=>s.kind==='primary' && s.url===data.judgment?.judgmentUrl))fail('Include the judgment text URL as a primary source',['sources']);
  }
 }else if(data.judgment)fail('Judgment metadata is reserved for judgment entries',['judgment']);
 }),
});
export const collections={articles};
