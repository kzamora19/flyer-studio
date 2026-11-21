// Offline-only server fixture. Verify signed proofs with WebCrypto, not just field shape.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const encoder=new TextEncoder();
let sequence=0;
const nextChallenge=()=>Buffer.alloc(32,(++sequence)%255||1).toString('base64url');
export function createProofMock(){
 let key=null,challenge='',expiresAt='',sessionId='d151a9b1-4c42-4dd2-a20b-4b9cfef1a650';
 let recoveryAccount=83;
 return {
  setRecoveryAccount(value){
   if(!Number.isSafeInteger(value)||value<1||value>240)throw Error('Invalid mock account');
   recoveryAccount=value;
  },
  async handle(body,{expireMs=600000,denyOnCheck=false}={}){
   if(body.action==='load'){
    assert.equal(typeof body.ticket,'string');
    assert.equal(body.ticket.length,43);
    assert.equal(body.publicKey?.d,undefined,'Private key must never leave the browser');
    key=await webcrypto.subtle.importKey('jwk',body.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    challenge=nextChallenge();expiresAt=new Date(Date.now()+expireMs).toISOString();
    return {ok:true,sessionId,challenge,expiresAt,
      draftScope:Buffer.alloc(32,recoveryAccount).toString('base64url'),
      draftKey:Buffer.alloc(32,recoveryAccount-8>0?recoveryAccount-8:recoveryAccount+8).toString('base64url')};
   }
   assert.equal(body.action,'check');
   assert.equal(body.ticket,undefined,'Launch ticket must not be replayed for checks');
   assert.equal(body.sessionId,sessionId);
   assert.equal(body.challenge,challenge);
   assert.ok(/^[A-Za-z0-9_-]{86}$/.test(body.signature),'ECDSA P-256 signature expected');
   const message='ptg-studio-v1|flyer|'+body.sessionId+'|'+body.challenge;
   const verified=await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,
    Buffer.from(body.signature,'base64url'),encoder.encode(message));
   assert.equal(verified,true,'Browser proof must match the registered public key');
   if(denyOnCheck)return {ok:false,error:'PTG revoked'};
   challenge=nextChallenge();
   return {ok:true,sessionId,challenge,expiresAt};
  },
 };
}
