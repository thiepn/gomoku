/* A22 original provider witness import, no network, keys, approvals or upload. */
'use strict';
const crypto=require('node:crypto');
const P=require('./a22-qualified-parent.json'),W=require('./a18-signer-reconciliation.cjs');
const H=/^[a-f0-9]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function block(status,reason,details={}){
 return W.result(status,reason,{...details,hostedAccepted:false,providerAuthenticated:false,sourceRightsApproved:false});
}
function original({packet,bodies,upstream,signatures,roots,now=new Date()}={}){
 if(upstream?.status!=='escrow-originals-documentary-only'||upstream.realOwnerConsent!==false||
  packet?.format!=='GomokuA22ExternallyWitnessedOriginals'||packet.version!==22||
  packet.repository!=='thiepn/gomoku'||packet.sourceSha!==P.originalA9Source||
  packet.a21Head!==P.sourceHead||packet.escrowPreviousRoot!==upstream.finalReceiptDigest||
  packet.ownerRightsDecision!=='OPEN'||packet.humanHostPermissionGranted!==false||
  packet.actualProductionHostTouched!==false||packet.remoteProviderAuthenticated!==false||
  !H.test(packet.separateProviderObjectDigest||'')||
  !Array.isArray(packet.items)||packet.items.length<2||
  !bodies||typeof bodies!=='object')
  return block('blocked-provider-context','Original A21 byte escrow, owner rights or provider scope not sufficiently bound.');
 const ids=new Set(),digests=new Set();let root=packet.escrowPreviousRoot,at=null,seq=0;
 for(const item of packet.items){
  const data=bodies[item?.objectId];
  if(!item||!['original-a9-ci','dedicated-preview-response','external-witness-media','external-replay-receipt','previous-stable-archive'].includes(item.kind)||
   typeof item.objectId!=='string'||!item.objectId||ids.has(item.objectId)||
   !H.test(item.sha256||'')||digests.has(item.sha256)||
   !Buffer.isBuffer(data)||data.length<1||data.length>10*1024*1024||
   sha(data)!==item.sha256||item.bytes!==data.length||
   item.seq!==++seq||item.previousRoot!==root||
   !H.test(item.receiptRoot||'')||
   item.receiptRoot!==W.hash(Object.fromEntries(Object.entries(item).filter(([key])=>key!=='receiptRoot')))||
   !W.utc(item.receivedAt)||W.utc(item.receivedAt)>now||
   at&&W.utc(item.receivedAt)<=at||
   item.originalRightsStatus!=='NOT_APPROVED'||
   typeof item.custodian!=='string'||!item.custodian.trim()||
   typeof item.issuer!=='string'||!item.issuer.trim()||item.issuer===item.custodian)
   return block('blocked-original-byte','Original source/object bytes, custody root, independent claim or monotonic sequence invalid.');
  ids.add(item.objectId);digests.add(item.sha256);root=item.receiptRoot;at=W.utc(item.receivedAt);
 }
 if(Object.keys(bodies).length!==packet.items.length||packet.finalRoot!==root||
  packet.items[0].kind!=='original-a9-ci'||
  packet.items.some(x=>x.kind==='previous-stable-archive'&&x.sha256===P.originalOfflineZipSha256))
  return block('blocked-original-final','Unknown unscoped originals, broken last root or A9 mistaken for previous stable source.');
 const payload={sourceSha:P.originalA9Source,a21Head:P.sourceHead,
  previousRoot:packet.escrowPreviousRoot,finalRoot:packet.finalRoot,
  packetDigest:W.hash(packet),providerObjectDigest:packet.separateProviderObjectDigest};
 const signed=W.verify({kind:'host-byte-intake',payload,envelope:signatures,roots,now});
 return signed.status==='signed-originals-document-only'
  ?block('external-original-receipts-documentary-only','Bounded original object bytes and signed source/custody claims align, but human rights and provider independence remain unverified.',
    {verifiedObjectBytes:packet.items.length,finalRoot:root,sourceDigest:W.hash(packet)})
  :signed;
}
function resolveFork({base,left,right}={}){
 if(!H.test(base||'')||!Array.isArray(left)||!Array.isArray(right)||
  left.length<1||right.length<1)return block('blocked-fork-context','Two immutable external branches and common base required.');
 const comparisons=new Map(),conflicts=[];
 for(const [side,items] of [['left',left],['right',right]]){
  let root=base;
  for(let i=0;i<items.length;i++){
   const r=items[i];
   if(!r||r.seq!==i+1||r.previousRoot!==root||
    !H.test(r.receiptRoot||'')||!H.test(r.sha256||''))
    return block('blocked-fork-continuity','Escrow branch cannot skip source-anchored linked receipts.');
   const last=comparisons.get(i);
   if(last&&last.receiptRoot!==r.receiptRoot){
    conflicts.push({sequence:i+1,left:last.receiptRoot,right:r.receiptRoot});
   }else if(!last)comparisons.set(i,r);
   root=r.receiptRoot;
  }
 }
 return block(conflicts.length?'independent-provider-fork-conflict':'provider-branches-documents-consistent',
  conflicts.length?'Two custody witnesses disagree, independent manual source arbitration mandatory.':'Both witness snapshots have matching documentary receipts only.',
  {conflicts,automaticMerge:false,independentOwnerResolutionRequired:conflicts.length>0});
}
module.exports={original,resolveFork,sha,block};
