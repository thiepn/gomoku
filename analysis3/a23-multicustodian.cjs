/* A23 multi-custodian ORIGINAL BYTE documentary escrow. No real human/provider authority.
   Every successful result remains review-only; never a release or signature enrollment. */
'use strict';
const crypto=require('node:crypto'),W=require('./a18-signer-reconciliation.cjs');
const A14=require('./a14-custody.cjs'),P=require('./a23-parent-evidence.json');
const H=/^[a-f0-9]{64}$/,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const deny=(status,reason,extra={})=>W.result(status,reason,{...extra,
  realProviderAuthenticated:false,originalRightsAccepted:false,canAcceptLiveHost:false});
function twoWitnesses({payload,signatures,roots}={}){
 if(!roots||roots.format!=='GomokuA23WitnessRegistry'||roots.version!==23||
   !Array.isArray(roots.keys)||roots.keys.length!==2||
   !Array.isArray(signatures)||signatures.length!==2)
   return deny('blocked-actual-roots','Two separately governed original custodian/reviewer public keys required; source real registry remains EMPTY.');
 const expected=['custodian','reviewer'],people=new Set(),keyIds=new Set(),fprs=new Set();
 for(const role of expected){
  const k=roots.keys.find(x=>x.role===role),s=signatures.find(x=>x.role===role);
  if(!k||!s||!k.keyId||!k.person||s.keyId!==k.keyId||
   s.person!==k.person||people.has(k.person)||keyIds.has(k.keyId)||
   !H.test(k.spkiSha256||'')||fprs.has(k.spkiSha256)||
   roots.revokedKeyIds?.includes(k.keyId)||
   !/-----BEGIN PUBLIC KEY-----/.test(k.publicKeyPem||''))
   return deny('blocked-witness-independence','Original custodian/reviewer role, person, fingerprint or revocation conflict.');
  let pk;
  try{pk=crypto.createPublicKey(k.publicKeyPem);
   if(pk.asymmetricKeyType!=='ed25519'||
      sha(pk.export({format:'der',type:'spki'}))!==k.spkiSha256||
      !crypto.verify(null,Buffer.from(A14.canonical(payload)),pk,Buffer.from(s.signature,'base64')))
     return deny('blocked-witness-signature','Original detached Ed25519 witness contract/signature invalid.');
  }catch{return deny('blocked-witness-signature','Invalid external original public key or signature bytes.');}
  people.add(k.person);keyIds.add(k.keyId);fprs.add(k.spkiSha256);
 }
 return deny('synthetic-detached-witness-document-only','Ed25519 source bytes verify against supplied keys; independent actual human/provider authority NOT established.');
}
function inspect({packet,objects,prior,signatures,roots,now=new Date()}={}){
 if(prior?.status!=='external-original-receipts-documentary-only'||
   packet?.format!=='GomokuA23MultiCustodianEscrow'||packet.version!==23||
   packet.repository!=='thiepn/gomoku'||packet.sourceSha!==P.a9OriginalSha||
   packet.a22Head!==P.a22Head||packet.previousRoot!==prior.finalRoot||
   packet.ownerOriginalRights==='OPEN'||packet.ownerOriginalRights!=='NOT_APPROVED'||
   packet.externalProviderAuthenticated!==false||packet.realHostTouched!==false||
   packet.actualHumanApproval!==false||packet.productionDataIncluded!==false||
   !Array.isArray(packet.receipts)||packet.receipts.length<2||
   !objects||typeof objects!=='object'||!H.test(packet.originalPacketDigest||''))
   return deny('blocked-original-scope','Previous A22 escrow, original owner rights and original byte scope must remain source-bound and not approved.');
 const ids=new Set(),digests=new Set();let root=packet.previousRoot,lastAt=null;
 for(const [i,r] of packet.receipts.entries()){
  const b=objects[r?.id];
  if(!r||!r.id||ids.has(r.id)||!['original-a9','isolated-preview','device-original','assistive-original','distinct-prior-stable','provider-journal'].includes(r.kind)||
    !Buffer.isBuffer(b)||b.length<1||b.length>10*1024*1024||
    !H.test(r.sha256||'')||sha(b)!==r.sha256||digests.has(r.sha256)||
    r.byteLength!==b.length||r.sequence!==i+1||
    r.previousRoot!==root||!H.test(r.receiptRoot||'')||
    r.receiptRoot!==W.hash(Object.fromEntries(Object.entries(r).filter(([key])=>key!=='receiptRoot')))||
    !W.utc(r.collectedAt)||W.utc(r.collectedAt)>now||
    lastAt&&W.utc(r.collectedAt)<=lastAt||
    !r.providerId||!r.issuerId||r.providerId===r.issuerId||
    r.realAuthorizationObtained!==false||!H.test(r.rightsSha256||''))
    return deny('blocked-original-receipt','Missing, duplicated, mutated or non-sequential original source/object custodian bytes.');
  ids.add(r.id);digests.add(r.sha256);root=r.receiptRoot;lastAt=W.utc(r.collectedAt);
 }
 if(Object.keys(objects).length!==packet.receipts.length||
    packet.finalRoot!==root||packet.receipts[0].kind!=='original-a9'||
    packet.receipts.some(r=>r.kind==='distinct-prior-stable'&&r.sha256===P.a9NestedZipSha256))
    return deny('blocked-escrow-completeness','Unknown original, invalid final source-root or A9 incorrectly used as previous stable.');
 const payload={sourceSha:P.a9OriginalSha,a22Head:P.a22Head,
  previousRoot:packet.previousRoot,finalRoot:packet.finalRoot,
  originalPacketDigest:packet.originalPacketDigest,originalReceiptListDigest:W.hash(packet.receipts)};
 const check=twoWitnesses({payload,signatures,roots});
 return check.status==='synthetic-detached-witness-document-only'
  ?deny('multi-custodian-originals-documentary-only','Original bytes and two detached documents reconcile, but independent provider/human rights and host permission remain OPEN.',
    {originalCount:packet.receipts.length,finalRoot:root,packetDigest:W.hash(packet)}):check;
}
function fork({commonRoot,branches}={}){
 if(!H.test(commonRoot||'')||!Array.isArray(branches)||branches.length<2)
  return deny('blocked-fork-branches','At least two independently held branches with same original source root.');
 const bySeq=new Map(),disputed=[];
 for(const b of branches){
  if(!b||!b.providerId||!Array.isArray(b.receipts)||!b.receipts.length)
   return deny('blocked-fork-provider','Original independent provider and receipt branch missing.');
  let root=commonRoot;
  for(const [i,r] of b.receipts.entries()){
   if(r?.sequence!==i+1||r.previousRoot!==root||!H.test(r.receiptRoot||'')||!H.test(r.sha256||''))
    return deny('blocked-fork-integrity','Noncontiguous provider CAS/root chain.');
   const prior=bySeq.get(i);
   if(prior&&prior.digest!==r.receiptRoot)disputed.push({sequence:i+1,providers:[prior.provider,b.providerId],hashes:[prior.digest,r.receiptRoot]});
   else if(!prior)bySeq.set(i,{digest:r.receiptRoot,provider:b.providerId});
   root=r.receiptRoot;
  }
 }
 return deny(disputed.length?'escrow-source-conflict':'escrow-documentary-concordance',
  disputed.length?'Divergent original provider claims are placed in mandatory human custody escrow; no auto-winner.':'Receipt histories agree documentarily; independent external custody still unverified.',
  {disputed,automaticWinner:null,originalsPublished:false});
}
module.exports={inspect,fork,twoWitnesses,sha,deny};
