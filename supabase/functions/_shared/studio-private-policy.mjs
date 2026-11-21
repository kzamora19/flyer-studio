// Pure input guards shared by the Edge proof and no-network regression tests.
export const studioTicketOk = x => typeof x === 'string' && /^[A-Za-z0-9_-]{43}$/.test(x);
export const releasePathOk = x => typeof x === 'string' &&
  /^releases\/[a-f0-9]{12,64}\/studio\.html$/.test(x);
export const sha256Ok = x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
export function exactHttpsOrigin(value) {
 if(typeof value!=='string'||!value.trim())return '';
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||
     u.pathname!=='/'||!/^[a-z0-9.-]+$/i.test(u.hostname)||u.hostname.includes('..')||
     (value.trim()!==u.origin&&value.trim()!==u.origin+'/'))return '';
  return u.origin;
 }catch{return ''}
}
export function deliveryConfigured({origin,secret,serviceKey,path,sha,bucket}){
 return !!exactHttpsOrigin(origin) && typeof secret==='string'&&secret.length>=32 &&
  typeof serviceKey==='string'&&serviceKey.length>=32&&
  releasePathOk(path)&&sha256Ok(sha)&&bucket==='flyer-editor-release';
}

export function validProofResponse(value){
 return !!value && typeof value==="object" &&
  typeof value.sessionId==="string" &&
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sessionId) &&
  typeof value.challenge==="string" && /^[A-Za-z0-9_-]{43}$/.test(value.challenge) &&
  typeof value.expiresAt==="string" && Number.isFinite(Date.parse(value.expiresAt));
}
