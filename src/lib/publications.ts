import {getCollection,type CollectionEntry} from 'astro:content';
import {publicationTypes} from '../data/publication';
export type Article=CollectionEntry<'articles'>;
export function articlePath(entry:Article){
 if(!entry.data.slug)throw new Error('Missing publication slug: '+entry.id);
 return '/'+publicationTypes[entry.data.type].section+'/'+entry.data.slug+'/';
}
export async function publishedArticles(){
 const entries=await getCollection('articles',({data})=>!data.draft);
 const paths=new Set<string>();
 for(const entry of entries){
  const path=articlePath(entry);
  if(paths.has(path))throw new Error('Duplicate publication route: '+path);
  paths.add(path);
 }
 return entries.sort((a,b)=>(b.data.publishedAt?.getTime()??0)-(a.data.publishedAt?.getTime()??0)||articlePath(a).localeCompare(articlePath(b)));
}
export function relatedArticles(entry:Article,entries:Article[],limit=4){
 const subjects=new Set(entry.data.areas.filter(a=>a!=='general'));
 return entries.filter(other=>other.id!==entry.id && !other.data.draft)
 .map(other=>({entry:other,score:other.data.areas.filter(a=>subjects.has(a)).length}))
 .filter(other=>other.score>0)
 .sort((a,b)=>b.score-a.score)
 .slice(0,limit).map(item=>item.entry);
}
export function formatDate(date:Date){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(date)}
export function isoDate(date:Date){return date.toISOString().slice(0,10)}
