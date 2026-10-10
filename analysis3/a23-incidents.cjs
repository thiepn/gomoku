/* A23 operator incident continuity / key compromise reconciliation. SOURCE ONLY. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),P=require('./a23-parent-evidence.json');
const crypto=require('node:crypto'),H=/^[a-f0-9]{64}$/,N=/^[a-f0-9]{32}$/;
const fail=(status,reason,other={})=>W.result(status,reason,{...other,
  globalReplayCertified:false,keysRotated:false,recoveryExecuted:false});
function reconcile({packet,originalProviderBytes,sourceJournal,prior,now=new Date()}={}){
 if(prior?.status!=='incident-originals-documentary-only'||
  packet?.format!=='GomokuA23MultiProviderIncident'||packet.version!==23||
  packet.a22Head!==P.a22Head||packet.originalSourceSha!==P.a9OriginalSha||
  packet.ownerPermission!=='OPEN'||packet.globalLedgerActuallyOperated!==false||
  packet.realKeyRotated!==false||packet.productionRestoreExecuted!==false||
  !H.test(packet.initialRoot||'')||!H.test(packet.finalRoot||'')||
  !Array.isArray(packet.events)||packet.events.length<2||
  !Buffer.isBuffer(originalProviderBytes)||!originalProviderBytes.length||
  originalProviderBytes.length>10*1024*1024||
  crypto.createHash('sha256').update(originalProviderBytes).digest('hex')!==packet.providerObjectSha256||
  !Array.isArray(sourceJournal?.entries)||sourceJournal.entries.length<2)
  return fail('blocked-incident-origin','Cannot reconcile provider bytes, original source challenge journal or unapproved release.');
 const events=new Set(),claims=new Map(),revoked=new Map(),rotations=new Map(),usedKeys=new Set();
 let root=packet.initialRoot,last=null;
 for(const [i,e] of packet.events.entries()){
  if(!e||e.sequence!==i+1||!['issue','consume','compromise','revoke','rotate','recover-review'].includes(e.action)||
   !H.test(e.eventSha256||'')||events.has(e.eventSha256)||
   e.parentRoot!==root||!H.test(e.nextRoot||'')||
   !N.test(e.challenge||'')||!H.test(e.originalEvidenceSha256||'')||
   typeof e.operator!=='string'||!e.operator.trim()||
   !W.utc(e.at)||W.utc(e.at)>now||last&&W.utc(e.at)<=last)
   return fail('blocked-provider-sequence','Duplicate, reordered or tampered original CAS history.');
  if(e.action==='issue'){
   if(claims.has(e.challenge)||!H.test(e.scopeSha256||''))
    return fail('blocked-replay-issue','One issue per unique global nonce, exact scope required.');
   claims.set(e.challenge,{state:'issued',issuer:e.operator,scope:e.scopeSha256});
  }else if(e.action==='consume'){
   const c=claims.get(e.challenge);
   if(!c||c.state!=='issued'||c.issuer===e.operator||c.scope!==e.scopeSha256)
    return fail('blocked-replay-consume','Concurrent, duplicate, self-signed or cross-scope consumption denied.');
   c.state='consumed';c.consumer=e.operator;
  }else if(e.action==='compromise'||e.action==='revoke'){
   if(!e.keyId||revoked.has(e.keyId)||!H.test(e.fingerprintSha256||'')||
    !H.test(e.separateOwnerReceiptSha256||'')||e.operator===e.keyOwner)
    return fail('blocked-key-revocation','Source-bound independent custodian and monotonic revocation missing.');
   revoked.set(e.keyId,{fingerprint:e.fingerprintSha256,owner:e.keyOwner,reviewer:e.operator});
  }else if(e.action==='rotate'){
   const old=revoked.get(e.replacedKeyId);
   if(!old||!e.newKeyId||revoked.has(e.newKeyId)||usedKeys.has(e.newKeyId)||
    old.owner===e.operator||old.reviewer===e.operator||
    old.fingerprint!==e.replacedFingerprintSha256||
    !H.test(e.newFingerprintSha256||'')||e.newFingerprintSha256===old.fingerprint||
    !H.test(e.independentWitnessReceiptSha256||''))
    return fail('blocked-key-rotation','Compromised key cannot be reactivated; independent replacement ID/fingerprint and reviewer required.');
   usedKeys.add(e.newKeyId);rotations.set(e.newKeyId,e.replacedKeyId);
  }else{
   const c=claims.get(e.challenge);
   if(!c||c.state!=='consumed'||e.operator===c.consumer||e.operator===c.issuer||
    e.recoveryActuallyPerformed!==false||
    !H.test(e.previousStableOriginalSha256||'')||
    e.previousStableOriginalSha256===P.a9NestedZipSha256||
    !H.test(e.isolatedRestoreReceiptSha256||''))
    return fail('blocked-recovery-review','Recovery needs third independent operator, distinct prior-stable originals and no actual restoration.');
   c.state='review-only';
  }
  events.add(e.eventSha256);root=e.nextRoot;last=W.utc(e.at);
 }
 if(root!==packet.finalRoot||!Array.isArray(packet.revokedKeyIds)||
  packet.revokedKeyIds.length!==revoked.size||packet.revokedKeyIds.some(id=>!revoked.has(id)))
  return fail('blocked-final-provider-roots','Exact final root and durable monotonic revocation set required.');
 const history=packet.events.filter(e=>['issue','consume'].includes(e.action));
 const local=sourceJournal.entries.filter(e=>['issue','consume'].includes(e.action));
 if(history.length!==local.length||history.some((e,i)=>e.action!==local[i].action||e.challenge!==local[i].challenge))
  return fail('blocked-original-journal','A15 original journal and independent provider challenge sequence diverge.');
 return fail('multi-provider-incident-documentary-only','Source, provider bytes, replay, key compromise and recovery notes structurally consistent only. No independent real provider, signer or human authority.',
  {head:root,revokedKeyIds:[...revoked.keys()],replacementKeyIds:[...rotations.keys()],states:[...claims.values()].map(x=>x.state)});
}
function conflict({packets,sourceRoot}={}){
 if(!H.test(sourceRoot||'')||!Array.isArray(packets)||packets.length<2)
  return fail('blocked-conflict-input','Two separately sourced operator incident packets required.');
 const byKey=new Map(),seen=new Set(),conflicts=[];
 for(const p of packets){
  if(p?.format!=='GomokuA23IncidentProposal'||p.a22Head!==P.a22Head||
   p.sourceSha!==P.a9OriginalSha||p.baseRoot!==sourceRoot||
   !N.test(p.challenge||'')||!H.test(p.originalPacketSha256||'')||
   !['consume','revoke','rotate','recover-review'].includes(p.action)||
   !p.operator||p.executed!==false)
   return fail('blocked-operator-original','Owner/source/operator provenance missing.');
  const event=p.action+':'+p.challenge,entry=p.operator+':'+event;
  if(seen.has(entry))return fail('blocked-duplicate-claim','Same operator repeated an identical original claim.');
  seen.add(entry);
  const original=byKey.get(event);
  if(original&&original.originalPacketSha256!==p.originalPacketSha256)
    conflicts.push({action:p.action,challenge:p.challenge,operators:[original.operator,p.operator]});
  else if(!original)byKey.set(event,p);
 }
 return fail(conflicts.length?'provider-originals-conflict':'provider-originals-documentary-aligned',
  conflicts.length?'Competing source-original claims require human/provider arbitration; no automatic winner.':'Documentary proposals aligned, but real provider CAS remains unverified.',
  {conflicts,automaticWinner:null});
}
module.exports={reconcile,conflict,fail};
