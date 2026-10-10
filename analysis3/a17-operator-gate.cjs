/* A17 non-deploying operator authorization boundary. Documents != authenticated consent. */
'use strict';
const LOCK=require('./a10-source-lock.json');
const A10=require('./a10-preview-integrity.cjs');
const crypto=require('node:crypto');
const H64=/^[a-f0-9]{64}$/;
const OPERATIONS=Object.freeze(['preview-read','physical-draft','isolated-restore','external-ledger-review']);
function result(status,reason,extra={}){
 return Object.freeze({format:'GomokuA17OperatorGate',version:17,status,reason,...extra,
  canDeploy:false,canMerge:false,canTag:false,canModifyProductionData:false,
  canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
  notice:'Permission data is a scoped operator worksheet, NOT an authenticated human signature. Independently confirm authorization and originals; CI and local tests may never count as human approval.'});
}
function validate({approval,operation,approved=false,now=new Date(),targetOrigin}={}){
 if(approved!==true)return result('blocked-permission','Explicit interactive operator opt-in is required.');
 if(!OPERATIONS.includes(operation))return result('blocked-action','Operation is not allowlisted.');
 if(approval?.format!=='GomokuA17OperatorScope'||approval.version!==17||
   approval.repository!=='thiepn/gomoku'||approval.originalSourceSha!==LOCK.sourceSha||
   approval.a16HeadSha!=='bb868a84d24f622f8f5dcab64756c803228db8d0'||
   !Array.isArray(approval.allowedOperations)||approval.allowedOperations.length<1||
   approval.allowedOperations.length>OPERATIONS.length||
   new Set(approval.allowedOperations).size!==approval.allowedOperations.length||
   approval.allowedOperations.some(x=>!OPERATIONS.includes(x))||
   !approval.allowedOperations.includes(operation)||
   typeof approval.operator!=='string'||!approval.operator.trim()||
   typeof approval.authorizedBy!=='string'||!approval.authorizedBy.trim()||
   approval.operator===approval.authorizedBy||
   !H64.test(approval.originalAuthorizationDigest||'')||
   !H64.test(approval.scopeRecordDigest||'')||
   !/^[a-f0-9]{32}$/.test(approval.nonce||''))
  return result('blocked-scope','Exact source, independent approver, ops, nonce and evidence digests missing.');
 const issued=Date.parse(approval.issuedAt),expires=Date.parse(approval.expiresAt);
 const t=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(t)||!Number.isFinite(issued)||!Number.isFinite(expires)||
   expires<=issued||expires-issued>60*60*1000||issued>t+60*1000||expires<=t)
  return result('blocked-time','Operator scope expired, future-dated or over an hour long.');
 if(operation==='preview-read'||operation==='physical-draft'){
  let u;try{u=A10.previewUrl(targetOrigin);}catch{
   return result('blocked-origin','Target must be an isolated, exact, dedicated HTTPS .vercel.app root.');
  }
  if(u.toString()!==approval.exactPreviewOrigin||approval.exactPreviewOrigin!==targetOrigin)
   return result('blocked-origin','Operator approved origin differs from the exact requested host.');
 }else if(targetOrigin!==undefined){
  return result('blocked-origin','Filesystem and external-ledger review cannot select a network host.');
 }
 return result('scoped-document-only','Scope fields are structurally consistent. Independent owner consent and source validation are still required.',
   {operation,operator:approval.operator,scopeDigest:crypto.createHash('sha256').update(JSON.stringify(approval)).digest('hex')});
}
module.exports={validate,result,OPERATIONS};
