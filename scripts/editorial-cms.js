const $=id=>document.getElementById(id);
const token=document.querySelector('meta[name=rr-session]').content;
let queue=null,current=null,selected=new Set(),busy=false,tab='edit';
const node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e};
const append=(p,...children)=>p.append(...children);
const message=(s,err=false)=>{$('message').textContent=s;$('message').className=err?'error':''};
async function api(action,fields={}){
 const r=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-RR-Session':token},body:JSON.stringify({action,...fields})});
 const result=await r.json();if(!r.ok)throw Error(result.error||'Request failed');return result;
}
function task(fn){return async()=>{if(busy)return;busy=true;try{message('');await fn()}catch(e){message(e.message,true)}finally{busy=false}}}
function option(value,label=value){const e=node('option',label);e.value=value;return e}
function fillOptions(el,items,initial){const v=el.value;el.replaceChildren(...(initial?[option('',initial)]:[]),...items.map(x=>option(x.value,x.label)));if([...el.options].some(o=>o.value===v))el.value=v}
function button(label,fn){const e=node('button',label);e.addEventListener('click',task(fn));return e}
function dirty(){return current&&($('raw').value!==current.raw||reviewDirty())}
function reviewDirty(){return current&&!$('review').hidden&&$('reviewForm').dataset.dirty==='1'}
function mayLeave(){return !dirty()||confirm('Discard unsaved edits or review changes?')}
function visible(){const q=$('search').value.toLowerCase();return (queue?.items??[]).filter(i=>(!$('type').value||i.type===$('type').value)&&(!$('status').value||i.status===$('status').value)&&[i.title,i.id,...i.notes,...i.sources.map(s=>s.title+' '+s.url)].join(' ').toLowerCase().includes(q))}
function list(){
 $('queue').replaceChildren();const rows=visible();$('count').textContent=rows.length+' records · '+selected.size+' selected';
 for(const i of rows){const row=node('div',undefined,'entry'),c=node('input');c.type='checkbox';c.disabled=!i.draft||i.template;c.checked=selected.has(i.id);c.setAttribute('aria-label','Select '+i.title);c.onchange=()=>{if(c.checked)selected.add(i.id);else selected.delete(i.id);$('count').textContent=rows.length+' records · '+selected.size+' selected'};
 const b=button(i.title,async()=>{if(mayLeave())await open(i.id)});if(current?.item.id===i.id)b.className='active';append(b,node('small',i.type+' · '+i.status));append(row,c,b);$('queue').append(row)}
}
async function reload(){queue=await api('queue');$('metrics').replaceChildren();for(const [k,v] of Object.entries(queue.counts)){const e=node('div',undefined,'metric');append(e,node('strong',v),node('span',k));$('metrics').append(e)}
 fillOptions($('type'),[...new Set(queue.items.map(i=>i.type))].map(v=>({value:v,label:v})),'All types');fillOptions($('status'),Object.keys(queue.counts).map(v=>({value:v,label:v})),'All statuses');
 fillOptions($('manifest'),queue.manifests.map(m=>({value:m.path,label:m.title||m.path})),'Select local manifest');$('import').disabled=!queue.manifests.length;
 $('acquisition').replaceChildren();for(const a of queue.acquisition){const e=node('div',undefined,'acq');append(e,node('strong',a.title),node('div',a.state+' · '+a.count+' selected groups'),node('small',a.sourceStatus));$('acquisition').append(e)}list();
}
const payload=()=>({id:current.item.id,hash:current.item.sha256});
function showTab(name){tab=name;for(const p of document.querySelectorAll('.panel'))p.hidden=p.id!==name;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name)}
function setDetail(d){
 current=d;$('empty').hidden=true;$('detail').hidden=false;$('title').textContent=d.item.title;$('docmeta').textContent=d.item.type+' · '+d.item.id;$('path').textContent=d.item.path;$('state').textContent=d.state.status;
 $('raw').value=d.raw;$('rendered').innerHTML=d.preview??'';if(d.preview===null)$('rendered').append(node('pre',JSON.stringify(d.metadata.provisions??[],null,2)));
 const readonly=!d.item.draft||d.item.template;$('raw').readOnly=readonly;$('save').disabled=readonly;$('preview').disabled=d.item.kind!=='article';$('compare').hidden=d.item.kind!=='import';$('comparison').replaceChildren();$('prepare').disabled=readonly||d.state.status!=='ready';$('missing').replaceChildren(...d.state.missing.map(x=>node('li',x)));
 renderReview(readonly);renderLinks(readonly);showTab(tab);list();
}
async function open(id){setDetail(await api('detail',{id}))}
async function update(d){setDetail(d);await reload()}
function field(parent,label,value='',kind='text'){const l=node('label',label),e=node(kind==='textarea'?'textarea':'input');if(kind!=='textarea')e.type=kind;e.value=value??'';l.append(e);parent.append(l);return e}
function check(parent,label,checked=false){const l=node('label'),e=node('input');e.type='checkbox';e.checked=checked;l.append(e,document.createTextNode(' '+label));parent.append(l);return e}
let reviewFields;
function renderReview(readonly){
 const d=current,r=d.record??{decision:'in-review',reviewer:'',reviewedAt:'',note:'',checks:{},sources:{}},p=$('reviewForm');p.replaceChildren();p.dataset.dirty='0';p.oninput=()=>p.dataset.dirty='1';
 const stale=d.state.status==='stale',disabled=readonly||stale;
 $('reset').hidden=!stale||readonly;$('saveReview').disabled=disabled;
 const decision=node('select');for(const x of ['in-review','blocked','approved'])decision.append(option(x));decision.value=r.decision;const l=node('label','Decision');l.append(decision);p.append(l);
 reviewFields={decision,reviewer:field(p,'Human reviewer',r.reviewer),reviewedAt:field(p,'Actual review date',r.reviewedAt,'date'),note:field(p,'Review summary',r.note,'textarea'),checks:{},sources:{}};
 p.append(node('h3','Editorial checks'));for(const k of d.item.requiredChecks)reviewFields.checks[k]=check(p,k,r.checks?.[k]===true);
 p.append(node('h3','Source verification'));for(const s of d.item.sources){const box=node('div',undefined,'source'),a=node('a',s.title);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';append(box,a,node('div',s.kind+' · '+(s.pinpoint||'No pinpoint')));reviewFields.sources[s.key]={verified:check(box,'Verified against appropriate source',r.sources?.[s.key]?.verified===true),note:field(box,'Evidence / verification note',r.sources?.[s.key]?.note??'','textarea')};p.append(box)}
 for(const e of p.querySelectorAll('input,textarea,select'))e.disabled=disabled;
}
function needSaved(){if($('raw').value!==current.raw)throw Error('Save or discard draft edits first');if(reviewDirty())throw Error('Save review edits first')}
function renderLinks(readonly){
 const p=$('relations');p.replaceChildren();const d=current.metadata;
 if(current.item.kind!=='article'){p.append(node('p','Article relationships are not editable on statute records.'));return}
 const refs=d.statuteRefs??[];p.append(node('h3','Statutory references'));
 for(const [index,r] of refs.entries()){const box=node('div',r.act+(r.provision?'/'+r.provision:''),'relationship');if(!readonly)box.append(button('Remove',async()=>{needSaved();await update(await api('links',{...payload(),change:{kind:'statute',action:'remove',index}}))}));p.append(box)}
 for(const c of current.item.candidates)p.append(node('p','Research suggestion: '+c.act+'/'+(c.provision??'manual mapping')+' · '+c.status));
 const targets=queue?.targets??{statutes:[],judgments:[]};
 if(!readonly&&targets.statutes.length){const a=node('select'),v=node('select');fillOptions(a,targets.statutes.map(x=>({value:x.slug,label:x.title})),'Choose Act');function fill(){fillOptions(v,(targets.statutes.find(x=>x.slug===a.value)?.provisions??[]).map(x=>({value:x.slug,label:x.heading})),'Act-level reference')}a.onchange=fill;fill();append(p,a,v,button('Add statutory reference',async()=>{needSaved();await update(await api('links',{...payload(),change:{kind:'statute',action:'add',act:a.value,provision:v.value}}))}))}else p.append(node('p','No reviewed statutory targets available, or document is read-only.'));
 if(current.item.type!=='judgment')return;
 p.append(node('h3','Judicial treatment'));for(const [index,r] of (d.judgment?.treatments??[]).entries()){const box=node('div',r.relation+' · '+r.targetCase+' · '+r.pinpoint,'relationship');if(!readonly)box.append(button('Remove',async()=>{needSaved();await update(await api('links',{...payload(),change:{kind:'judgment',action:'remove',index}}))}));p.append(box)}
 if(readonly||!targets.judgments.length){p.append(node('p','No reviewed judgment targets available, or document is read-only.'));return}
 const t=node('select'),r=node('select');fillOptions(t,targets.judgments.map(x=>({value:x.slug,label:x.title})),'Select target judgment');for(const x of ['cited','followed','relied-on','distinguished','explained','approved','overruled','partly-overruled','doubted','referred-to-larger-bench'])r.append(option(x));append(p,t,r);const issue=field(p,'Issue'),pinpoint=field(p,'Pinpoint in this judgment'),explanation=field(p,'Explanation','','textarea');p.append(button('Add judicial treatment',async()=>{needSaved();await update(await api('links',{...payload(),change:{kind:'judgment',action:'add',targetSlug:t.value,relation:r.value,issue:issue.value,pinpoint:pinpoint.value,explanation:explanation.value}}))}));
}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{if(tab==='review'&&reviewDirty()&&b.dataset.tab!=='review'&&!confirm('Leave unsaved review changes?'))return;showTab(b.dataset.tab)};
$('search').oninput=list;$('status').onchange=list;$('type').onchange=list;
$('selectAll').onclick=()=>{for(const i of visible())if(i.draft&&!i.template)selected.add(i.id);list()};
$('bulk').onclick=task(async()=>{if(!selected.size)throw Error('Select at least one draft');if(dirty())throw Error('Save current changes before bulk action');const r=await api('bulk',{ids:[...selected]});selected.clear();await reload();if(current)await open(current.item.id);message(r.created+' review templates created; '+r.skipped+' existing or ineligible records skipped. No approvals.')});
$('refresh').onclick=task(async()=>{if(!mayLeave())return;await reload();if(current)await open(current.item.id)});
$('save').onclick=task(async()=>{if(reviewDirty())throw Error('Save review changes or discard them before editing');await update(await api('save',{...payload(),raw:$('raw').value}));message('Draft saved. Any prior review is now stale if the draft changed.')});
$('preview').onclick=task(async()=>{$('rendered').innerHTML=(await api('preview',{raw:$('raw').value})).html});
$('saveReview').onclick=task(async()=>{if($('raw').value!==current.raw)throw Error('Save draft changes before review');const f=reviewFields,r={decision:f.decision.value,reviewer:f.reviewer.value,reviewedAt:f.reviewedAt.value,note:f.note.value,checks:Object.fromEntries(Object.entries(f.checks).map(([k,v])=>[k,v.checked])),sources:Object.fromEntries(Object.entries(f.sources).map(([k,v])=>[k,{verified:v.verified.checked,note:v.note.value}]))};await update(await api('review',{...payload(),record:r,recordHash:current.recordHash}));message('Review record saved. No publication.')});
$('reset').onclick=task(async()=>{if(confirm('Archive the stale review and clear all checks?'))await update(await api('reset',payload()))});
$('prepare').onclick=task(async()=>{needSaved();const r=await api('prepare',{...payload(),date:$('publicationDate').value});message(r.path+'\n'+r.note)});
$('compare').onclick=task(async()=>{needSaved();const r=await api('compare',payload());$('comparison').replaceChildren(node('p',r.warning));for(const v of r.rows){const row=node('div',undefined,'compare-row'),panes=node('div',undefined,'comparison');append(row,node('h3',v.provision+' · '+v.version+' · '+v.status),node('p',v.pinpoint));for(const [label,txt] of [['Original extracted text',v.original],['Current draft text',v.current]]){const col=node('div');append(col,node('strong',label),node('pre',txt));panes.append(col)}row.append(panes);$('comparison').append(row)}});
$('import').onclick=task(async()=>{if(!mayLeave())return;if(!$('manifest').value)throw Error('Select a manifest');const r=await api('import',{path:$('manifest').value});await reload();await open(r.id);message(r.count+' provisions imported as a local draft.')});
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue=''}});
task(reload)();
