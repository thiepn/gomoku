/* A21 offline operator conflict and recovery proof. No global ledger RPC or state mutation. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),LOCK=require('./a10-source-lock.json');
const P=require('./a21-qualified-parent.json'),A20=require('./a20-multioperator-recovery.cjs');
const H=/^[a-f0-9]{64}$/;
const fail=(status,reason,more={})=>W.result(status,reason,{...more,
  canExecuteRecovery:false,globalReplayAuthenticated:false,keysProvisioned:false});
function prove({journal,prior,originalProofBytes,sourceLocal,roots,now=new Date()}={}){
 if(prior?.status!=='multioperator-documentary-consistent'||
  journal?.format!=='GomokuA21IndependentRecoveryProof'||journal.version!==21||
  journal.sourceSha!==LOCK.sourceSha||journal.a20Head!==P.head||
  journal.ownerDecision!=='NOT_APPROVED'||journal.productionRestored!==false||
  journal.productionPlayerDataAccessed!==false||
  !H.test(journal.originalProviderRoot||'')||!H.test(journal.externalAuditDigest||'')||
  !H.test(journal.priorStableArchiveSha256||'')||
  journal.priorStableArchiveSha256===P.originalNestedZipSha256||
  !Array.isArray(journal.operations)||journal.operations.length<3||
  !Buffer.isBuffer(originalProofBytes)||originalProofBytes.length<1||originalProofBytes.length>10*1024*1024||
  !H.test(journal.originalProofSha256||'')||
  require('node:crypto').createHash('sha256').update(originalProofBytes).digest('hex')!==journal.originalProofSha256||
  !sourceLocal?.entries?.length)
  return fail('blocked-recovery-proof','Original external provider byte proof, prior-stable/owner scope or immutable local journal missing.');
 const events=new Set(),issued=new Map(),revoked=new Set(),usedRecovery=new Set();
 let prev=journal.originalProviderRoot,at=null;const operatorAction=new Map();
 for(let i=0;i<journal.operations.length;i++){
  const e=journal.operations[i];
  if(!e||e.index!==i+1||!['issue','consume','revoke','recover','compromise'].includes(e.action)||
   !H.test(e.previousRoot||'')||e.previousRoot!==prev||
   !H.test(e.nextRoot||'')||!H.test(e.eventDigest||'')||
   events.has(e.eventDigest)||!/^[a-f0-9]{32}$/.test(e.challenge||'')||
   typeof e.operator!=='string'||!e.operator.trim()||
   !W.utc(e.observedAt)||W.utc(e.observedAt)>now||
   at&&W.utc(e.observedAt)<=at)
   return fail('blocked-recovery-order','Provider CAS root, unique events or chronological operator scope conflict.');
  if(e.action==='issue'){
   if(issued.has(e.challenge)||!H.test(e.scopeDigest||''))return fail('blocked-replay-issue','Challenge issued more than once or missing original scope.');
   issued.set(e.challenge,{scope:e.scopeDigest,issuedBy:e.operator,state:'issued'});
  }else if(e.action==='consume'){
   const r=issued.get(e.challenge);
   if(!r||r.state!=='issued'||r.issuedBy===e.operator||e.scopeDigest!==r.scope)
    return fail('blocked-replay-consume','Unissued/double consume or colluding same-operator decision.');
   r.state='consumed';r.consumedBy=e.operator;
  }else if(e.action==='recover'){
   const r=issued.get(e.challenge);
   if(!r||r.state!=='consumed'||usedRecovery.has(e.challenge)||
    r.issuedBy===e.operator||r.consumedBy===e.operator||
    e.priorStableArchiveSha256!==journal.priorStableArchiveSha256||
    e.actualRestorePerformed!==false||!H.test(e.isolatedRehearsalSha256||''))
    return fail('blocked-recovery-conflict','Recovery requires independent third operator and distinct unchanged previous stable original.');
   usedRecovery.add(e.challenge);r.state='reviewed-only';
  }else if(e.action==='revoke'||e.action==='compromise'){
   if(typeof e.keyId!=='string'||!e.keyId.trim()||revoked.has(e.keyId)||
    !H.test(e.sourceFingerprintSha256||'')||
    !H.test(e.independentCustodianRecordSha256||'')||
    e.operator===e.compromisedSignerId)
    return fail('blocked-compromise','Immutable key chronology, source fingerprint and independent revoker required.');
   revoked.add(e.keyId);
  }
  operatorAction.set(e.eventDigest,e.operator);events.add(e.eventDigest);
  prev=e.nextRoot;at=W.utc(e.observedAt);
 }
 if(journal.finalProviderRoot!==prev||
   !journal.operations.some(x=>x.action==='issue')||
   !journal.operations.some(x=>x.action==='consume')||
   !journal.operations.some(x=>x.action==='recover')||
   !Array.isArray(journal.revokedKeys)||
   journal.revokedKeys.length!==revoked.size||
   journal.revokedKeys.some(k=>!revoked.has(k)))
  return fail('blocked-recovery-closure','No valid completed documentary issue/consume/recover, revocation chronology or pinned final root.');
 const local=sourceLocal.entries.filter(x=>x.action==='issue'||x.action==='consume');
 const remote=journal.operations.filter(x=>x.action==='issue'||x.action==='consume');
 if(local.length!==remote.length||remote.some((x,i)=>x.action!==local[i].action||
    x.challenge!==local[i].challenge))
   return fail('blocked-local-source','Original A15 local journal not equal to independent provider source-grain events.');
 if(roots?.keys?.length&&roots.keys.some(k=>revoked.has(k.keyId)&&k.isActive===true))
  return fail('blocked-revoked-trust','A compromised or revoked key cannot remain active in proposed trust snapshot.');
 return fail('original-recovery-documentary-only','Complete original-byte-backed external recovery document reconciles; real provider signing, owner approval and real restore still unverified.',
  {operations:journal.operations.length,reviewedRecoveryChallenges:[...usedRecovery],revokedKeys:[...revoked]});
}
function reconcileOperators({packets,externalRoot}={}){
 if(!H.test(externalRoot||'')||!Array.isArray(packets)||packets.length<2)
  return fail('blocked-operator-packets','At least two independently sourced operator proposals and common previous root required.');
 const seen=new Set(),byChallenge=new Map(),conflicts=[];
 for(const p of packets){
  if(!p||p.format!=='GomokuA21OperatorProposal'||p.sourceSha!==LOCK.sourceSha||
   p.a20Head!==P.head||p.previousRoot!==externalRoot||
   !/^[a-f0-9]{32}$/.test(p.challenge||'')||
   !H.test(p.packetSha256||'')||typeof p.operator!=='string'||!p.operator.trim()||
   !['consume','recover','revoke'].includes(p.operation)||
   p.authorityGranted!==false)
   return fail('blocked-operator-proposal','Original proposed CAS root/source/operator invalid.');
  if(seen.has(p.operator+':'+p.challenge+':'+p.operation))
   return fail('blocked-duplicate-operator','Identical operator duplicated its attempted transaction.');
  seen.add(p.operator+':'+p.challenge+':'+p.operation);
  const key=p.challenge+':'+p.operation,other=byChallenge.get(key);
  if(other&&other.packetSha256!==p.packetSha256)
   conflicts.push({challenge:p.challenge,operation:p.operation,operators:[other.operator,p.operator],packetHashes:[other.packetSha256,p.packetSha256]});
  else if(!other)byChallenge.set(key,p);
 }
 return fail(conflicts.length?'operator-cas-conflict':'operator-documents-consistent',
  conflicts.length?'Competing operator proposals against identical root detected; cannot automatically choose a winner.':'Source-bound proposals match documentary intent; authentic global CAS state unavailable.',
  {conflicts,automaticWinner:null,recoveryPerformed:false});
}
function reviewSignerTransition({previousRoots,proposedRoots,rotationReview,
  globalDocument,compromise,originalBytes,now=new Date()}={}){
 if(globalDocument?.status!=='original-recovery-documentary-only'||
  !compromise||compromise.format!=='GomokuA21SignerCompromiseOriginal'||
  compromise.version!==21||compromise.sourceSha!==LOCK.sourceSha||
  compromise.a20Head!==P.head||
  !H.test(compromise.originalByteSha256||'')||
  !H.test(compromise.independentOperatorReceiptSha256||'')||
  compromise.originalByteSha256===compromise.independentOperatorReceiptSha256||
  typeof compromise.compromisedKeyId!=='string'||!compromise.compromisedKeyId||
  typeof compromise.affectedRole!=='string'||!compromise.affectedRole||
  !W.utc(compromise.detectedAt)||W.utc(compromise.detectedAt)>now||
  compromise.reviewerIsCompromisedSigner!==false||
  compromise.realSignerAuthorityGranted!==false||
  !Buffer.isBuffer(originalBytes)||originalBytes.length<1||
  originalBytes.length>10*1024*1024||
  require('node:crypto').createHash('sha256').update(originalBytes).digest('hex')!==compromise.originalByteSha256)
  return fail('blocked-compromise-original','Original compromise bytes, independent observation, operator roles or source scope missing.');
 const prior=W.verifiedRoots(previousRoots),next=W.verifiedRoots(proposedRoots);
 if(!prior||!next)return fail('blocked-compromise-trust','Cannot self-enroll new roots or reuse a revoked, unreviewed signer.');
 const old=prior.get(compromise.affectedRole),replacement=next.get(compromise.affectedRole);
 if(!old||!replacement||old.keyId!==compromise.compromisedKeyId||
  old.keyId===replacement.keyId||
  !proposedRoots.revokedKeys.includes(old.keyId)||
  previousRoots.revokedKeys.some(x=>!proposedRoots.revokedKeys.includes(x))||
  !H.test(compromise.oldFingerprintSha256||'')||
  old.spkiSha256!==compromise.oldFingerprintSha256||
  !H.test(compromise.newFingerprintSha256||'')||
  replacement.spkiSha256!==compromise.newFingerprintSha256||
  old.person===replacement.person)
  return fail('blocked-compromise-replacement','Compromised key must be irrevocably revoked and replaced by distinct reviewed fingerprint and person.');
 const rotation=W.rotation({prior:previousRoots,proposed:proposedRoots,review:rotationReview,now});
 if(rotation.status!=='ready-for-human-key-rotation-review')return rotation;
 return fail('signer-compromise-transition-documentary-only',
  'The immutable compromise bytes, revoked prior fingerprint and independently signed replacement epoch reconcile. No real key was installed or authorized.',
  {revokedKeyId:old.keyId,newKeyId:replacement.keyId,realKeysInstalled:false});
}
module.exports={prove,reconcileOperators,reviewSignerTransition,fail};
