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

export function validSignedProof(value){
 return !!value && typeof value==="object" &&
  typeof value.sessionId==="string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.sessionId) &&
  typeof value.challenge==="string" && /^[A-Za-z0-9_-]{43}$/.test(value.challenge) &&
  typeof value.signature==="string" && /^[A-Za-z0-9_-]{80,96}$/.test(value.signature);
}

/**
 * Cross-project PTG Studio authorization endpoint.
 * Staging must NEVER call the production PTG project; production cannot
 * silently accept an unreviewed alternative verification endpoint.
 * HTTPS only, exact Supabase function path, no port/query/credentials.
 */
export const PRODUCTION_PTG_REF = "agknxlowackphvwyvxge";
export function validPtgGatewayUrl(raw,mode) {
 if(typeof raw!=="string" || !["staging","production"].includes(mode))return "";
 try{
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.search||u.hash||
     u.pathname!=="/functions/v1/ptg-studio-access")return "";
  const match=/^([a-z0-9]{20})\.supabase\.co$/.exec(u.hostname);
  if(!match || u.hostname!==u.hostname.toLowerCase())return "";
  const isProd=match[1]===PRODUCTION_PTG_REF;
  if(mode==="staging"&&isProd)return "";
  if(mode==="production"&&!isProd)return "";
  if(raw!==u.href)return "";
  return u.href;
 }catch{return "";}
}
