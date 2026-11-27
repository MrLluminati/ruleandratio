// Public build-time link only: no staff origin, secrets, session or member data.
export function accountOrigin(value,enabled){
 if(enabled!=='true')return undefined;
 if(typeof value!=='string'||!value.trim())throw Error('Account links require a confirmed PUBLIC_RR_ACCOUNT_ORIGIN');
 const url=new URL(value.trim());
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||url.hostname.endsWith('.invalid')||url.hostname.endsWith('.workers.dev')||url.hostname.endsWith('.pages.dev')||url.hostname==='localhost'||!url.hostname.includes('.'))throw Error('Account links require a confirmed HTTPS custom origin');
 return url.origin;
}
export const memberAccountOrigin=accountOrigin(process.env.PUBLIC_RR_ACCOUNT_ORIGIN,process.env.PUBLIC_RR_ACCOUNT_LINKS);
