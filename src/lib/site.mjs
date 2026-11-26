// Only explicitly supplied production origins are accepted. No guessed domain.
const raw=process.env.PUBLIC_RR_SITE_URL?.trim();
export const indexing=process.env.PUBLIC_RR_INDEXING==='true';
function origin(value){
 if(!value)return undefined;
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port||url.hostname==='localhost'||url.hostname.endsWith('.pages.dev'))throw new Error('PUBLIC_RR_SITE_URL must be the confirmed HTTPS production origin');
 return url.origin;
}
export const siteOrigin=origin(raw);
if(indexing&&!siteOrigin)throw new Error('Indexing requires a confirmed PUBLIC_RR_SITE_URL');
export const absolute=(path)=>siteOrigin?new URL(path,siteOrigin).href:undefined;
