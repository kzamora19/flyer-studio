export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const validRole=role=>['SYSTEM_ADMIN','BRANCH_ADMIN','BRANCH_USER'].includes(role);
export const permissions=role=>({canApprove:['SYSTEM_ADMIN','BRANCH_ADMIN'].includes(role),canOverride:role==='SYSTEM_ADMIN'});
export function validReviewPayload(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 if(body.action==='permissions')return true;
 if(body.action==='assets-list')return typeof body.category==='string'&&['','logos','banners','backgrounds','templates','decorations','other'].includes(body.category);
 if(body.action==='asset-image')return uuid(body.assetId);
 if(!['approve','final','override'].includes(body.action)||!uuid(body.projectId)||!['front','back','both'].includes(body.scope)||typeof body.digest!=='string'||! /^[a-f0-9]{64}$/.test(body.digest))return false;
 if(!Array.isArray(body.warnings)||body.warnings.length>100||!body.warnings.every(x=>typeof x==='string'&&x.length<=400))return false;
 if(!Array.isArray(body.blocking)||body.blocking.length>100||!body.blocking.every(x=>typeof x==='string'&&x.length<=400))return false;
 if(body.action==='approve')return body.blocking.length===0&&body.format==='approval';
 if(!['png','pdf'].includes(body.format))return false;
 if(body.action==='final')return uuid(body.approvalId)&&body.blocking.length===0;
 return typeof body.reason==='string'&&body.reason.trim().length>=10&&body.reason.trim().length<=1000&&body.acknowledged===true;
}
