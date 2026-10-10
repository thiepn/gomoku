/* A21 offline-only independently held evidence escrow: original bytes, append-only object custody.
   Documentary verification never establishes a human signer, external provider, or release. */
'use strict';
const crypto=require('node:crypto');
const PIN=require('./a21-qualified-parent.json'),LOCK=require('./a10-source-lock.json');
const W=require('./a18-signer-reconciliation.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),H=/^[a-f0-9]{64}$/;
function out(status,reason,other={}){return W.result(status,reason,{...other,
  realOwnerConsent:false,realOriginalAcceptance:false,remoteProviderAuthenticated:false})}
function validate({archive,originals,prior,signatures,roots,now=new Date()}={}){
 if(archive?.format!=='GomokuA21EscrowOriginals'||archive.version!==21||
  archive.repository!=='thiepn/gomoku'||archive.sourceSha!==LOCK.sourceSha||
  archive.a20Head!==PIN.head||archive.ownerRightsDecision!=='UNAPPROVED'||
  archive.actualHostAccessed!==false||archive.productionPlayerDataIncluded!==false||
  archive.approvedByRealHuman!==false||archive.providerExternalIndependenceVerified!==false||
  !Array.isArray(archive.items)||archive.items.length<2||
  !Array.isArray(originals)||originals.length!==archive.items.length||
  !H.test(archive.parentManifestDigest||'')||!H.test(archive.sourceEvidenceDigest||''))
  return out('blocked-escrow-context','Source/purpose/bounded original custody or owner rights missing.');
 const identifiers=new Set(),content=new Set();
 let priorDigest=archive.parentManifestDigest,lastSequence=0,lastAt=null;
 for(let i=0;i<archive.items.length;i++){
  const e=archive.items[i],b=originals[i];
  if(!e||!Buffer.isBuffer(b)||b.length<1||b.length>10*1024*1024||
   !H.test(e.sha256||'')||hash(b)!==e.sha256||
   !H.test(e.prevReceiptDigest||'')||e.prevReceiptDigest!==priorDigest||
   !H.test(e.receiptDigest||'')||
   e.sequence!==lastSequence+1||typeof e.objectId!=='string'||!e.objectId||
   identifiers.has(e.objectId)||content.has(e.sha256)||
   !['a9-ci-original','preview-response-original','device-media-original','accessibility-media-original','previous-stable-original','replay-provider-original'].includes(e.kind)||
   !W.utc(e.observedAt)||W.utc(e.observedAt)>now||
   lastAt&&W.utc(e.observedAt)<=lastAt||
   e.originalCopyImmutableClaimed!==true||e.providerCustodianId===e.operatorId||
   typeof e.providerCustodianId!=='string'||!e.providerCustodianId.trim()||
   typeof e.operatorId!=='string'||!e.operatorId.trim()||
   e.receiptDigest!==W.hash({...e,receiptDigest:undefined}) &&
   e.receiptDigest!==W.hash(Object.fromEntries(Object.entries(e).filter(([key])=>key!=='receiptDigest'))))
   return out('blocked-escrow-original','Tampered bytes, replayed object/receipt, untrusted provider identity or broken sequence.');
  identifiers.add(e.objectId);content.add(e.sha256);
  priorDigest=e.receiptDigest;lastSequence=e.sequence;lastAt=W.utc(e.observedAt);
 }
 if(archive.finalReceiptDigest!==priorDigest||archive.items.some(x=>x.kind==='previous-stable-original'&&x.sha256===PIN.originalNestedZipSha256))
  return out('blocked-escrow-final','Final provider receipt root or separate previous-stable identity mismatch.');
 if(prior?.status!=='external-originals-documentary-ready'||
  archive.sourceEvidenceDigest!==prior.receiptDigest||
  archive.items[0].kind!=='a9-ci-original')
  return out('blocked-escrow-parent','Original CI source + independently held A20 source documentary continuity missing.');
 const payload={sourceSha:LOCK.sourceSha,a20Head:PIN.head,
   parentManifestDigest:archive.parentManifestDigest,sourceEvidenceDigest:archive.sourceEvidenceDigest,
   escrowFinalDigest:archive.finalReceiptDigest,originalObjects:archive.items.length};
 const signed=W.verify({kind:'host-byte-intake',payload,envelope:signatures,roots,now});
 return signed.status==='signed-originals-document-only'?
  out('escrow-originals-documentary-only','Actual supplied original bytes and independent-looking signed receipts reconcile; real external provider and human ownership remain unverified.',
  {objectCount:archive.items.length,finalReceiptDigest:archive.finalReceiptDigest,byteHashesVerified:true}):signed;
}
function reconcileForks({left,right,baseRoot}={}){
 if(!H.test(baseRoot||'')||!Array.isArray(left)||!Array.isArray(right))
  return out('blocked-custody-fork-input','Two original custody branches and pinned base root required.');
 const byIndex=new Map(),clashes=[];
 for(const [label,records] of [['left',left],['right',right]]){
  let previous=baseRoot;
  for(let i=0;i<records.length;i++){
   const e=records[i];
   if(!e||e.sequence!==i+1||e.prevReceiptDigest!==previous||
    !H.test(e.receiptDigest||'')||!H.test(e.sha256||''))
    return out('blocked-custody-fork-integrity','Independent escrow branch failed chain continuity.');
   const prev=byIndex.get(i);
   if(prev&&prev.receiptDigest!==e.receiptDigest)clashes.push({sequence:i+1,left:prev.receiptDigest,right:e.receiptDigest});
   else byIndex.set(i,e);
   previous=e.receiptDigest;
  }
 }
 return out(clashes.length?'custody-fork-conflict':'escrow-branches-documentary-consistent',
  clashes.length?'Divergent independently claimed append-only escrow heads. Manual external operator arbitration required.':'Both documentary branches agree; provider authenticity not established.',
  {conflicts:clashes,requiresIndependentHumanResolution:clashes.length>0,automaticallyResolve:false});
}
module.exports={validate,reconcileForks,hash,out};
