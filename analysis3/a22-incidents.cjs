/* A22 independent multi-operator incidents: never mutates externally administered roots. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),P=require('./a22-qualified-parent.json');
const H=/^[a-f0-9]{64}$/;
const D=/^[a-f0-9]{32}$/;
const denied=(status,reason,extra={})=>W.result(status,reason,{...extra,canExecuteIncident:false,canRestoreProduction:false,canRotateKeys:false,globalCASAuthenticated:false});
function reconcile({incident,localJournal,originalProof,provenance,now=new Date()}={}){
 if(incident?.format!=='GomokuA22CrossOperatorIncident'||incident.version!==22||
  incident.sourceSha!==P.originalA9Source||incident.a21Head!==P.sourceHead||
  incident.realHumanDecision!=='OPEN'||incident.productionTouched!==false||
  incident.providerIndependentlyAuthenticated!==false||
  !H.test(incident.initialRoot||'')||!H.test(incident.finalRoot||'')||
  !Array.isArray(incident.events)||incident.events.length<2||
  !Buffer.isBuffer(originalProof)||originalProof.length<1||originalProof.length>10*1024*1024||
  require('node:crypto').createHash('sha256').update(originalProof).digest('hex')!==incident.originalProofSha256||
  !Array.isArray(localJournal?.entries)||localJournal.entries.length<2||
  provenance?.status!=='external-original-receipts-documentary-only')
  return denied('blocked-incident-origin','No original source, bounded independent provider audit bytes or earlier escrow custody.');
 const eventIds=new Set(),nonce=new Map(),revocations=new Map(),operatorRoles=new Map();
 let previous=incident.initialRoot,at=null;
 for(let i=0;i<incident.events.length;i++){
  const x=incident.events[i];
  if(!x||!['issue','consume','compromise','revoke','rotate','recover-review'].includes(x.action)||
   x.index!==i+1||!H.test(x.eventId||'')||eventIds.has(x.eventId)||
   x.previousRoot!==previous||!H.test(x.nextRoot||'')||
   typeof x.actor!=='string'||x.actor.trim().length<3||
   !W.utc(x.observedAt)||W.utc(x.observedAt)>now||
   at&&W.utc(x.observedAt)<=at||
   !D.test(x.challenge||'')||!H.test(x.originalPacketDigest||''))
   return denied('blocked-incident-sequence','External source-root CAS, timestamp or unique provider event missing.');
  if(x.action==='issue'){
   if(nonce.has(x.challenge)||!H.test(x.scopeDigest||''))
    return denied('blocked-global-issue','Issued nonce cannot be reissued under conflicting scope.');
   nonce.set(x.challenge,{state:'issued',issuer:x.actor,scope:x.scopeDigest,packet:x.originalPacketDigest});
  }else if(x.action==='consume'){
   const n=nonce.get(x.challenge);
   if(!n||n.state!=='issued'||n.issuer===x.actor||n.scope!==x.scopeDigest||
    n.packet!==x.originalPacketDigest)
    return denied('blocked-consume-race','Only independent single consume of exact challenged original accepted for documentary review.');
   n.state='consumed';n.consumer=x.actor;
  }else if(x.action==='compromise'||x.action==='revoke'){
   if(!x.keyId||!H.test(x.keyFingerprint||'')||!H.test(x.independentRightsDigest||'')||
    x.actor===x.keyOwner||revocations.has(x.keyId))
    return denied('blocked-key-compromise','No unsigned duplicated/reintroduced key compromise or self-revocation allowed.');
   revocations.set(x.keyId,{action:x.action,fp:x.keyFingerprint,reviewer:x.actor,owner:x.keyOwner});
  }else if(x.action==='rotate'){
   const old=revocations.get(x.previousKeyId);
   if(!old||!x.newKeyId||x.newKeyId===x.previousKeyId||
    revocations.has(x.newKeyId)||old.reviewer===x.actor||x.actor===old.owner||
    !H.test(x.oldFingerprint||'')||old.fp!==x.oldFingerprint||
    !H.test(x.newFingerprint||'')||x.newFingerprint===x.oldFingerprint||
    x.newKeyId===x.keyOwner||!H.test(x.independentOwnerReceiptDigest||''))
    return denied('blocked-key-rotation','Rotation requires pinned old compromise, new fingerprint, distinct reviewer and owner original.');
   operatorRoles.set(x.newKeyId,{old:x.previousKeyId,fp:x.newFingerprint,reviewer:x.actor});
  }else if(x.action==='recover-review'){
   const n=nonce.get(x.challenge);
   if(!n||n.state!=='consumed'||[n.consumer,n.issuer].includes(x.actor)||
    x.priorStableSha256===P.originalOfflineZipSha256||
    !H.test(x.priorStableSha256||'')||x.actualRestorePerformed!==false||
    !H.test(x.isolatedRecoveryDigest||''))
    return denied('blocked-recovery-custody','Distinct third witness and original prior stable synthetic-only receipt required.');
   n.state='recovery-review-only';
  }
  eventIds.add(x.eventId);previous=x.nextRoot;at=W.utc(x.observedAt);
 }
 if(previous!==incident.finalRoot||!Array.isArray(incident.revokedKeyIds)||
  incident.revokedKeyIds.length!==revocations.size||
  incident.revokedKeyIds.some(k=>!revocations.has(k)))
  return denied('blocked-revocation-head','Global provider root or durable revoked signer set contradicts original records.');
 const events=incident.events.filter(x=>x.action==='issue'||x.action==='consume');
 const source=localJournal.entries.filter(x=>x.action==='issue'||x.action==='consume');
 if(source.length!==events.length||source.some((x,i)=>x.action!==events[i].action||
  x.challenge!==events[i].challenge))
  return denied('blocked-local-history','Independent provider original issue/consume does not equal immutable A15 source journal.');
 return denied('incident-originals-documentary-only','External multioperator CAS, key compromise and source journal align structurally; no real provider, human signer or physical approval.',
  {events:incident.events.length,revokedKeyIds:[...revocations.keys()],rotations:[...operatorRoles.keys()],
   reviewedNonceStates:[...nonce.values()].map(x=>x.state)});
}
function collide({proposals,expectedRoot}={}){
 if(!H.test(expectedRoot||'')||!Array.isArray(proposals)||proposals.length<2)
  return denied('blocked-race-context','At least two separate operator original receipts required.');
 const id=new Set(),transactions=new Map(),disputes=[];
 for(const x of proposals){
  if(x?.format!=='GomokuA22OperatorRace'||x.sourceSha!==P.originalA9Source||
   x.a21Head!==P.sourceHead||x.baseRoot!==expectedRoot||
   !D.test(x.challenge||'')||!H.test(x.proposedDigest||'')||
   !['consume','recover','rotate','revoke'].includes(x.operation)||
   typeof x.operator!=='string'||!x.operator.trim()||
   x.actualTransactionExecuted!==false)
   return denied('blocked-race-proposal','Conflicting operator original/source/CAS proposal invalid.');
  const ix=x.operator+':'+x.operation+':'+x.challenge;
  if(id.has(ix))return denied('blocked-repeat-operator','One operator duplicated its original proposal.');
  id.add(ix);
  const key=x.operation+':'+x.challenge;
  const first=transactions.get(key);
  if(first&&first.proposedDigest!==x.proposedDigest)
   disputes.push({operation:x.operation,challenge:x.challenge,operators:[first.operator,x.operator]});
  else if(!first)transactions.set(key,x);
 }
 return denied(disputes.length?'independent-incident-conflict':'incident-proposals-documentary-consistent',
  disputes.length?'Divergent operator proof proposals require independent custody adjudication; no automatic CAS winner.':'Operator proposals agree, still no authenticated global provider.',
  {disputes,automaticResolution:false});
}
module.exports={reconcile,collide,denied};
