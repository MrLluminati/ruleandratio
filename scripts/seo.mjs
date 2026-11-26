import {readdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,relative,sep} from 'node:path';
import {load} from 'cheerio';
import assert from 'node:assert/strict';
import {indexing,siteOrigin,absolute} from '../src/lib/site.mjs';

const dir='dist';
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(p,e.name)):[join(p,e.name)]);
const files=walk(dir).filter(f=>f.endsWith('.html')&&!f.includes(sep+'pagefind'+sep));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const entries=[],feed=[];
for(const file of files){
 const $=load(readFileSync(file,'utf8'));
 const path='/'+relative(dir,file).split(sep).join('/').replace(/index\.html$/,'');
 const robots=$('meta[name="robots"]').attr('content')||'';
 const noindex=robots.split(',').some(v=>v.trim()==='noindex');
 const canonical=$('link[rel="canonical"]').attr('href');
 assert.equal($('title').length,1,'One title required: '+path);
 assert.ok($('meta[name="description"]').attr('content'),'Missing description: '+path);
 assert.equal($('meta[name="robots"]').length,1,'One robots tag required: '+path);
 assert.ok(indexing||noindex,'Preview page is indexable: '+path);
 assert.ok($('link[rel="canonical"]').length<=1,'Duplicate canonical: '+path);
 if(canonical){assert.equal(canonical,absolute(path),'Canonical mismatch: '+path);assert.equal($('meta[property="og:url"]').attr('content'),canonical,'OG URL mismatch: '+path)}
 for(const script of $('script[type="application/ld+json"]').toArray())JSON.parse($(script).text());
 if(noindex)continue;
 assert.ok(indexing&&canonical,'Indexable page lacks confirmed canonical: '+path);
 assert.ok(path!=='/search/'&&path!=='/404.html','Utility page indexable: '+path);
 entries.push(canonical);
 if($('meta[name="rr:feed"]').attr('content')==='article'){
  const published=$('meta[property="article:published_time"]').attr('content');
  assert.ok(published&&!isNaN(Date.parse(published)),'Invalid feed date: '+path);
  feed.push({url:canonical,title:$('h1').first().text(),description:$('meta[name="description"]').attr('content'),published});
 }
}
assert.ok(files.length>0,'No HTML output');
assert.ok(existsSync(join(dir,'pagefind','pagefind.js')),'Pagefind index missing');
const sitemap=join(dir,'sitemap.xml'),rss=join(dir,'rss.xml');
if(indexing){
 assert.ok(entries.includes(siteOrigin+'/'),'Launch requires reviewed content and an eligible homepage');
 assert.equal(new Set(entries).size,entries.length,'Duplicate sitemap URLs');
 assert.ok(entries.length<=50000,'Split sitemap before exceeding 50,000 URLs');
 writeFileSync(sitemap,'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.sort().map(url=>'<url><loc>'+esc(url)+'</loc></url>').join('')+'</urlset>\n');
 feed.sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
 const latest=feed.slice(0,50);
 writeFileSync(rss,'<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Rule &amp; Ratio</title><link>'+esc(siteOrigin+'/')+'</link><description>Reviewed legal publications from Rule &amp; Ratio</description><language>en-IN</language><atom:link href="'+esc(siteOrigin+'/rss.xml')+'" rel="self" type="application/rss+xml"/>'+latest.map(item=>'<item><title>'+esc(item.title)+'</title><link>'+esc(item.url)+'</link><guid isPermaLink="true">'+esc(item.url)+'</guid><description>'+esc(item.description)+'</description><pubDate>'+new Date(item.published).toUTCString()+'</pubDate></item>').join('')+'</channel></rss>\n');
}else{rmSync(sitemap,{force:true});rmSync(rss,{force:true})}
writeFileSync(join(dir,'robots.txt'),'User-agent: *\nAllow: /\n'+(indexing?'Sitemap: '+siteOrigin+'/sitemap.xml\n':''));
console.log('SEO validation passed: '+files.length+' HTML pages; '+entries.length+' indexable URLs; '+feed.length+' feed-eligible articles.');
