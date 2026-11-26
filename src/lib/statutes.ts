import {z} from 'astro/zod';
import {areas} from '../data/areas';
import {slugPattern} from '../data/publication';
const text=z.string().trim().min(1);
const slug=z.string().regex(slugPattern);
const url=z.string().url().refine(v=>/^https?:\/\//i.test(v));
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v},'Invalid calendar date');
const source=z.object({title:text,url,pinpoint:text.optional()});
const version=z.object({id:slug,effectiveFrom:date.optional(),effectiveUntil:date.optional(),text,source,amendmentIds:z.array(slug).default([]),note:text.optional()});
const provision=z.object({slug,number:text,kind:z.enum(['section','article','rule','schedule','order','regulation','other']),heading:text,chapter:slug.optional(),commentary:text.optional(),versions:z.array(version).min(1)});
const amendment=z.object({slug,title:text,description:text,source,effectiveDate:date.optional(),affectedProvisions:z.array(slug).default([])});
export const statuteSchema=z.object({
 slug,title:text,shortTitle:text.optional(),jurisdiction:text,areas:z.array(text.refine(v=>areas.some(a=>a.slug===v),'Unknown subject')).min(1),
 actNumber:text.optional(),year:z.number().int().positive().optional(),status:z.enum(['in-force','partly-in-force','repealed','not-commenced','uncertain']).optional(),
 source:source.optional(),reviewedAt:date.optional(),reviewer:text.optional(),coverage:z.enum(['selected-provisions','complete']).default('selected-provisions'),
 chapters:z.array(z.object({slug,label:text,title:text})).default([]),
 provisions:z.array(provision).default([]),amendments:z.array(amendment).default([]),draft:z.boolean().default(true)
});
export type Statute=z.infer<typeof statuteSchema>;
export type Provision=Statute['provisions'][number];
export type Amendment=Statute['amendments'][number];
export const actPath=(act:Statute)=>'/bare-acts/acts/'+act.slug+'/';
export const provisionPath=(act:Statute,p:Provision)=>actPath(act)+'provisions/'+p.slug+'/';
export const amendmentPath=(act:Statute,a:Amendment)=>actPath(act)+'amendments/'+a.slug+'/';
export const provisionLabel=(p:Provision)=>p.kind.charAt(0).toUpperCase()+p.kind.slice(1)+' '+p.number;
export function validateStatute(act:Statute){
 const fail=(msg:string)=>{throw new Error('Statute '+act.slug+': '+msg)};
 const unique=(items:string[],label:string)=>{if(new Set(items).size!==items.length)fail('Duplicate '+label)};
 unique(act.chapters.map(c=>c.slug),'chapter');unique(act.provisions.map(p=>p.slug),'provision');unique(act.amendments.map(a=>a.slug),'amendment');
 if(act.draft)return;
 if(!act.source||!act.reviewer||!act.reviewedAt||!act.status)fail('Reviewed statute needs source, reviewer, review date and status');
 if(act.reviewedAt!>new Date().toISOString().slice(0,10))fail('Future review date');
 if(!act.provisions.length)fail('No reviewed provisions');
 const amendments=new Map(act.amendments.map(a=>[a.slug,a]));
 for(const p of act.provisions){
  if(!p.commentary)fail('Original provision commentary required: '+p.slug);
  if(p.chapter&&!act.chapters.some(c=>c.slug===p.chapter))fail('Unknown chapter: '+p.chapter);
  unique(p.versions.map(v=>v.id),'version in '+p.slug);
  for(const v of p.versions){
   if(v.effectiveUntil && (!v.effectiveFrom || v.effectiveUntil<=v.effectiveFrom))fail('Invalid effective date interval in '+p.slug);
   for(const id of v.amendmentIds){const a=amendments.get(id);if(!a||!a.affectedProvisions.includes(p.slug))fail('Invalid amendment link: '+id)}
  }
  const dated=p.versions.filter(v=>v.effectiveFrom).sort((a,b)=>a.effectiveFrom!.localeCompare(b.effectiveFrom!));
  for(let i=1;i<dated.length;i++)if(!dated[i-1].effectiveUntil||dated[i-1].effectiveUntil!>dated[i].effectiveFrom!)fail('Overlapping dated versions in '+p.slug);
 }
 for(const a of act.amendments)for(const id of a.affectedProvisions)if(!act.provisions.some(p=>p.slug===id))fail('Unknown affected provision: '+id);
}
const records=import.meta.glob('../content/statutes/**/*.json',{eager:true,import:'default'});
export function publishedStatutes(){
 const acts=Object.entries(records).map(([path,raw])=>{const result=statuteSchema.safeParse(raw);if(!result.success)throw new Error(path+': '+result.error.message);validateStatute(result.data);return result.data}).filter(a=>!a.draft);
 if(new Set(acts.map(a=>a.slug)).size!==acts.length)throw new Error('Duplicate published statute slug');
 return acts.sort((a,b)=>a.title.localeCompare(b.title));
}
