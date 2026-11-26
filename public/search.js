const params=new URLSearchParams(location.search);
const form=document.querySelector('#rr-search');
const q=form.querySelector('#q'),type=form.querySelector('#type'),subject=form.querySelector('#subject');
const status=document.querySelector('#search-status'),results=document.querySelector('#search-results'),more=document.querySelector('#search-more');
q.value=(params.get('q')||'').slice(0,200);
type.value=params.get('type')||'';subject.value=params.get('subject')||'';
const term=q.value.trim();
let matches=[],offset=0,busy=false;
function append(tag,content,parent){const el=document.createElement(tag);el.textContent=content;parent.append(el);return el}
async function loadMore(){
 if(busy)return;
 busy=true;more.disabled=true;
 try{
  const batch=matches.slice(offset,offset+12);
  const data=await Promise.all(batch.map(x=>x.data()));
  for(const item of data){
   const target=new URL(item.url,location.origin);
   if(target.origin!==location.origin)continue;
   const card=append('article','',results);card.className='search-result';
   const heading=append('h2','',card);
   const link=append('a',item.meta?.title||target.pathname,heading);link.href=target.pathname+target.search+target.hash;
   append('p',(item.excerpt||'').replace(/<[^>]*>/g,''),card);
  }
  offset+=batch.length;
  more.hidden=offset>=matches.length;
  status.textContent=matches.length?matches.length+' result'+(matches.length===1?'':'s')+' · showing '+offset:'No matching results. Try a broader term or remove filters.';
 }catch(error){status.textContent='Unable to load search results. Try again or browse the knowledge library.';console.error(error)}
 finally{busy=false;more.disabled=false}
}
more.addEventListener('click',loadMore);
if(term){
 status.textContent='Searching…';
 try{
  const pagefind=await import('/pagefind/pagefind.js');
  const filters={};if(type.value)filters.Type=type.value;if(subject.value)filters.Subject=subject.value;
  const result=await pagefind.search(term,{filters});
  matches=result.results;
  await loadMore();
 }catch(error){status.textContent='Search is unavailable in this preview. Build the site or browse the knowledge library.';console.error(error)}
}
