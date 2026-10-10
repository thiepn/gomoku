/* A20 independently sourced original evidence escrow: read-only and default NO_GO. */
'use strict';
const crypto=require('node:crypto'),A14=require('./a14-custody.cjs');
const A18=require('./a18-signer-reconciliation.cjs'),A19=require('./a19-origin-custody.cjs');
const LOCK=require('./a10-source-lock.json'),ROOTS=require('./a20-external-roots.json');
const H=/^[a-f0-9]{64}$/,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const deny=(status,reason,extra={})=>A18.result(status,reason,{...extra,independentRealEvidenceAccepted:false,realHostAuthorized:false});
function inspect({receipt,originalBytes,priorA19,witness,roots,now=new Date()}={}){
 if(!receipt||receipt.format!=='GomokuA20OriginalReceipt'||receipt.version!==20||
  receipt.repository!=='thiepn/gomoku'||receipt.a19Head!==ROOTS.a19Head||
  receipt.originalA9Source!==LOCK.sourceSha||receipt.ownerPermissionState!=='OPEN'||
  receipt.actualProductionHostAccessed!==false||receipt.rightsOriginalOwnerApproval!=='PENDING'||
  receipt.independentProviderAuthenticatedClaimed!==true||
  !H.test(receipt.challengeDigest||'')||!H.test(receipt.objectSha256||'')||
  !H.test(receipt.previousObjectSha256||'')||
  !Number.isSafeInteger(receipt.sequence)||receipt.sequence<1||
  typeof receipt.deploymentId!=='string'||!receipt.deploymentId.trim()||
  !A18.utc(receipt.capturedAt)||A18.utc(receipt.capturedAt)>now||
  !Buffer.isBuffer(originalBytes)||originalBytes.length<1||originalBytes.length>10*1024*1024||
  sha(originalBytes)!==receipt.objectSha256)
  return deny('blocked-original-intake','Original independent provider byte object/source/owner-rights provenance missing.');
 if(priorA19?.status!=='host-original-bytes-reviewable'||
  priorA19.originalHostBytesChecked!==8||
  receipt.originalEightAssetsDigest!==priorA19.originalsDigest||
  !H.test(receipt.originalEightAssetsDigest||''))
  return deny('blocked-host-binding','Original A19 reviewed eight CI-backed HTTP assets not traceable to new detached receipt.');
 if(receipt.origin?.startsWith('https://gomoku.thiepn.dev')||
   !/^https:\/\/[a-z0-9-]+\.vercel\.app\/$/.test(receipt.origin||'')||
   receipt.requestMethod!=='GET'||receipt.redirected!==false||
   receipt.cookiesOrCredentialsSent!==false||
   receipt.separateOriginalsVaultClaimed!==true)
  return deny('blocked-origin','Only isolated, exact HTTPS preview GET bytes; no production origin, redirects, cookies or secret fetches.');
 const payload={sourceSha:LOCK.sourceSha,a19Head:ROOTS.a19Head,
  originalObjectSha256:receipt.objectSha256,receiptDigest:A18.hash(receipt),
  challengeDigest:receipt.challengeDigest,originalEightAssetsDigest:receipt.originalEightAssetsDigest};
 const w=A18.verify({kind:'host-byte-intake',payload,envelope:witness,roots,now});
 return w.status==='signed-originals-document-only'
  ?deny('external-originals-documentary-ready','Source/object hashes and signed documentary receipt match. Independent provider administration, owner rights and real hosted originals still require out-of-band acceptance.',
    {objectSha256:receipt.objectSha256,receiptDigest:A18.hash(receipt),originalsBytesVerified:true})
  :w;
}
function verifyPriorOriginal({oldOriginal,newOriginal,priorBytes,newBytes}={}){
 if(!oldOriginal||!newOriginal||!Buffer.isBuffer(priorBytes)||!Buffer.isBuffer(newBytes)||
  priorBytes.length===0||newBytes.length===0||
  oldOriginal.format!=='GomokuA20OriginalReceipt'||newOriginal.format!=='GomokuA20OriginalReceipt'||
  oldOriginal.a19Head!==ROOTS.a19Head||newOriginal.a19Head!==ROOTS.a19Head||
  newOriginal.sequence!==oldOriginal.sequence+1||
  newOriginal.previousObjectSha256!==oldOriginal.objectSha256||
  sha(priorBytes)!==oldOriginal.objectSha256||sha(newBytes)!==newOriginal.objectSha256||
  newOriginal.deploymentId!==oldOriginal.deploymentId||
  !A18.utc(newOriginal.capturedAt)||!A18.utc(oldOriginal.capturedAt)||
  A18.utc(newOriginal.capturedAt)<=A18.utc(oldOriginal.capturedAt))
  return deny('blocked-original-chain','Separated previous original object must be byte-verified, immutable and chronologically chained.');
 return deny('prior-original-chain-documentary','Two distinct original objects and provider hash chain reconcile; never proves externally administered custody.',
  {oldHash:oldOriginal.objectSha256,newHash:newOriginal.objectSha256});
}
module.exports={inspect,verifyPriorOriginal,sha};
