// HTML forms must retain their same-origin Origin header. Cross-origin referrers stay suppressed.
// Only the dashboard logout form can follow redirects to the configured OIDC logout provider.
export function formHeaders(issuer){
 let destination='';
 if(issuer)try{
  const u=new URL(issuer);
  if(u.protocol==='https:'&&!u.username&&!u.password&&[u.origin,u.origin+'/'].includes(issuer))destination=' '+u.origin+'/oidc/logout';
 }catch{/* Invalid issuer cannot broaden the policy. */}
 return {'referrer-policy':'same-origin','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"+destination+"; base-uri 'none'; frame-ancestors 'none'"};
}
