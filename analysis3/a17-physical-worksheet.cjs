/* A17 operator-facing original physical browser/PWA worksheet: observations are never certified by editing JSON. */
'use strict';
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const G=require('./a17-operator-gate.cjs');
const HASH=/^[a-f0-9]{64}$/;
const STATUSES=['not_tested','observed_pending_independent_review'];
function empty({origin='',createdAt=new Date().toISOString()}={}){
 const result={format:'GomokuA17OriginalDeviceWorksheet',version:17,
  sourceSha:LOCK.sourceSha,origin,createdAt,physicalAcceptance:'OPEN',
  platforms:Object.fromEntries(A9.PHYSICAL.map(p=>[p,{
   platform:p,device:'',osVersion:'',browserVersion:'',operator:'',
   cases:A9.DEVICE_CHECKS[p].map(id=>({id,status:'not_tested',observation:'',originalEvidenceDigest:null,observedAt:null}))
  }])),controlledSwUpdate:'not_tested',previousStableRollback:'not_tested',
  ownerAuthorization:'not_approved',independentReviewer:'not_approved'};
 return result;
}
function count(doc){
 const totals={required:18,pending:0,notTested:0,accepted:0};
 for(const p of A9.PHYSICAL)for(const c of doc.platforms?.[p]?.cases||[]){
  if(c.status==='observed_pending_independent_review')totals.pending++;
  else totals.notTested++;
 }
 return totals;
}
function record({worksheet,platform,caseId,observation,originalEvidenceDigest,observedAt,
  device,osVersion,browserVersion,operator,approval,approved=false,clock=()=>new Date()}={}){
 const origin=worksheet?.origin;
 const gate=G.validate({approval,approved,operation:'physical-draft',targetOrigin:origin,now:clock()});
 if(gate.status!=='scoped-document-only')return gate;
 const original=worksheet?.platforms?.[platform],cases=A9.DEVICE_CHECKS[platform];
 if(worksheet?.format!=='GomokuA17OriginalDeviceWorksheet'||worksheet.version!==17||
  worksheet.sourceSha!==LOCK.sourceSha||worksheet.physicalAcceptance!=='OPEN'||
  !Array.isArray(cases)||!original||!Array.isArray(original.cases)||original.cases.length!==cases.length||
  new Set(original.cases.map(x=>x.id)).size!==cases.length||
  !cases.every(id=>original.cases.some(x=>x.id===id))||!cases.includes(caseId))
  return G.result('blocked-worksheet','Unknown platform, case, missing test matrix or mismatched original source.');
 if(typeof observation!=='string'||observation.trim().length<24||
  /^(?:pass|yes|ok|test)$/i.test(observation.trim())||!HASH.test(originalEvidenceDigest||'')||
  typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt))||
  Date.parse(observedAt)>clock().getTime()+60000||
  Date.parse(observedAt)<Date.parse(approval.issuedAt)||
  [device,osVersion,browserVersion,operator].some(x=>typeof x!=='string'||!x.trim())||
  operator!==approval.operator)
  return G.result('blocked-original-observation','Dated physical operator context and independently retained original observation digest required.');
 const revised=structuredClone(worksheet),row=revised.platforms[platform];
 if(row.cases.find(x=>x.id===caseId).status!=='not_tested')
  return G.result('blocked-duplicate','Cannot silently replace or rewrite an already submitted original case.');
 if(row.device&&row.device!==device||row.operator&&row.operator!==operator)
  return G.result('blocked-device-switch','A physical evidence series cannot change its operator or device midway.');
 Object.assign(row,{device,osVersion,browserVersion,operator});
 Object.assign(row.cases.find(x=>x.id===caseId),{status:'observed_pending_independent_review',
  observation,originalEvidenceDigest,observedAt});
 return G.result('draft-observation-recorded','Original evidence reference recorded; never a qualified physical test, approval or real-device certification.',
  {worksheet:revised,counts:count(revised),independentReviewRequired:true});
}
function summary(worksheet){
 if(worksheet?.format!=='GomokuA17OriginalDeviceWorksheet'||worksheet.sourceSha!==LOCK.sourceSha)
  return G.result('blocked-worksheet','No original source-pinned device worksheet.');
 const counts=count(worksheet);
 return G.result('awaiting-independent-physical-review','All observations, even if submitted, remain unaccepted until independent original-device review.',
  {counts,swUpdate:worksheet.controlledSwUpdate,rollback:worksheet.previousStableRollback,
   physicalAcceptance:'OPEN'});
}
module.exports={empty,count,record,summary,STATUSES};
