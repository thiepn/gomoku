/* A20 independent multi-operator CAS, replay conflict, compromise and rollback documentary review. */
'use strict';
const A18=require('./a18-signer-reconciliation.cjs'),A14=require('./a14-custody.cjs');
const ROOTS=require('./a20-external-roots.json'),LOCK=require('./a10-source-lock.json');
const H=/^[a-f0-9]{64}$/;
const deny=(status,reason,extra={})=>A18.result(status,reason,{...extra,
  canExecuteRecovery:false,globalLedgerAuthenticated:false,realOwnerConsent:false});
const STATES=Object.freeze(['issue','consume','revoke','recover']);
function reconcile({log,originalLocal,roots=ROOTS,now=new Date()}={}){
 if(!log||log.format!=='GomokuA20MultiOperatorJournal'||log.version!==20||
  log.repository!=='thiepn/gomoku'||log.sourceSha!==LOCK.sourceSha||
  log.a19Head!==ROOTS.a19Head||log.productionTouched!==false||
  log.ownerApprovalStatus!=='OPEN'||log.globalProviderAttestedClaimed!==true||
  !H.test(log.firstRoot||'')||!Array.isArray(log.entries)||log.entries.length<2||
  !Array.isArray(log.revokedKeyIds)||new Set(log.revokedKeyIds).size!==log.revokedKeyIds.length||
  !originalLocal?.entries?.length)
  return deny('blocked-journal','Unverifiable independent provider/source/recovery custody.');
 const keys=roots.keys||[];
 if(keys.length===0||!Array.isArray(roots.providerTrustRoots)||roots.providerTrustRoots.length===0)
  return deny('blocked-provider-trust','No independently reviewed signer/provider roots are provisioned.');
 const seenEvent=new Set(),nonce=new Map(),revoked=new Set(),keyOwners=new Map(keys.map(k=>[k.keyId,k.operator]));let head=log.firstRoot,lastTime=null;
 for(const [i,e] of log.entries.entries()){
  if(!e||!STATES.includes(e.action)||!H.test(e.eventId||'')||
   seenEvent.has(e.eventId)||e.index!==i+1||
   e.previousRoot!==head||!H.test(e.nextRoot||'')||
   !/^[a-f0-9]{32}$/.test(e.challenge||'')||
   typeof e.operator!=='string'||!e.operator.trim()||
   !A18.utc(e.observedAt)||A18.utc(e.observedAt)>now||
   lastTime&&A18.utc(e.observedAt)<=lastTime||
   !H.test(e.payloadDigest||''))
   return deny('blocked-event-order','Duplicate, missing, out-of-order, replayed or altered event/epoch.');
  if(!roots.providerTrustRoots.includes(e.providerRootId))
   return deny('blocked-provider-identity','Provider root absent from independent pinned reviewed registry.');
  if(e.action==='issue'){
   if(nonce.has(e.challenge))return deny('blocked-duplicate-issue','Nonce is globally issued once only.');
   nonce.set(e.challenge,{state:'issued',issuer:e.operator,payload:e.payloadDigest});
  }else if(e.action==='consume'){
   const s=nonce.get(e.challenge);
   if(!s||s.state!=='issued'||s.issuer===e.operator||s.payload!==e.payloadDigest)
    return deny('blocked-consumption-race','Double consume, unissued nonce, self-review or cross-scope reuse.');
   s.state='consumed';s.consumer=e.operator;
  }else if(e.action==='revoke'){
   if(typeof e.revokedKeyId!=='string'||!e.revokedKeyId||
     revoked.has(e.revokedKeyId)||!keys.some(k=>k.keyId===e.revokedKeyId)||
     !keyOwners.get(e.revokedKeyId)||e.operator===keyOwners.get(e.revokedKeyId))
    return deny('blocked-revocation','Key revocation must be independently attributable and monotonically recorded.');
   revoked.add(e.revokedKeyId);
  }else if(e.action==='recover'){
   const s=nonce.get(e.challenge);
   if(!s||s.state!=='consumed'||s.consumer===e.operator||
    !H.test(e.previousStableArchiveSha256||'')||
    e.previousStableArchiveSha256===ROOTS.originalOfflineZipSHA256||
    e.realRecoveryExecuted!==false)
    return deny('blocked-recovery','Recovery requires distinct prior-stable archive, independent operator, consumed challenge and no real deployment.');
   s.state='recovery-reviewed';
  }
  seenEvent.add(e.eventId);lastTime=A18.utc(e.observedAt);head=e.nextRoot;
 }
 if(head!==log.finalRoot||revoked.size!==log.revokedKeyIds.length||
  log.revokedKeyIds.some(x=>!revoked.has(x))||
  !log.entries.some(e=>e.action==='issue')||!log.entries.some(e=>e.action==='consume'))
  return deny('blocked-final-state','Provider root/revocation set or issue/consume history incomplete.');
 const local=originalLocal.entries.filter(x=>x.action==='issue'||x.action==='consume');
 const remote=log.entries.filter(x=>x.action==='issue'||x.action==='consume');
 if(local.length!==remote.length||
  local.some((x,i)=>x.action!==remote[i].action||x.challenge!==remote[i].challenge||
   x.packetDigest&&x.packetDigest!==remote[i].payloadDigest))
  return deny('blocked-local-replay','Global provider events contradict immutable original A15 local issue/consume bytes.');
 if(!H.test(log.originalProviderArchiveDigest||'')||
  !H.test(log.externalProviderAuditDigest||'')||
  log.originalProviderArchiveDigest===log.externalProviderAuditDigest)
  return deny('blocked-provider-originals','Independent provider byte originals and third-party audit custody not grounded.');
 return deny('multioperator-documentary-consistent','Provider snapshots, multi-operator CAS and monotonic revocation documents reconcile. Authentic operator/provider authority remains OPEN.',
  {events:log.entries.length,finalRoot:head,nonceStates:[...nonce.values()].map(x=>x.state),
   revokedKeys:[...revoked]});
}
function compromisedKey({prior,proposed,review,globalReport,now=new Date()}={}){
 if(globalReport?.status!=='multioperator-documentary-consistent')
  return deny('blocked-global-ledger','Independent provider original replay journal not documentarily reconciled.');
 const rot=A18.rotation({prior,proposed,review,now});
 if(rot.status!=='ready-for-human-key-rotation-review')return rot;
 if(!globalReport.revokedKeys?.every(x=>proposed.revokedKeys.includes(x)))
  return deny('blocked-revocation-reconciliation','Externally revoked signer IDs cannot be reintroduced by proposed rotation.');
 return deny('compromise-recovery-review-only','Monotonic signer key rotation and third-party revocation documents ready for independent human review; no keys installed.');
}
module.exports={reconcile,compromisedKey,deny,STATES};
