/* A19: canonical original-byte custody contract. Never network/deploy/approve. */
'use strict';
const crypto=require('node:crypto'),A9=require('./rc9-core.cjs');
const LOCK=require('./a10-source-lock.json'),PINS=require('./a19-parent-evidence.json');
const A18=require('./a18-signer-reconciliation.cjs');
const HEX=/^[a-f0-9]{64}$/;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const no=(status,reason,extra={})=>A18.result(status,reason,{...extra,realAcceptanceGranted:false});
function base(manifest,kind){
 return manifest?.format==='GomokuA19ExternalOriginals'&&manifest.version===19&&
 manifest.kind===kind&&manifest.repository==='thiepn/gomoku'&&
 manifest.sourceSha===LOCK.sourceSha&&manifest.a18Head===PINS.a18Head&&
 HEX.test(manifest.challengeDigest||'')&&typeof manifest.deploymentId==='string'&&
 manifest.deploymentId.trim()&&
 manifest.ownerApprovalStatus==='OPEN'&&manifest.productionDataIncluded===false;
}
function originalHost({manifest,bytes,priorA18,signature,roots,now=new Date()}={}){
 if(!base(manifest,'host')||priorA18?.status!=='hosted-originals-ready-for-independent-human-review'||
  priorA18.hostedApproved!==false||manifest.origin!==priorA18.origin||
  manifest.originalA9ZipSha256!==LOCK.offlineZipSha256||
  manifest.preservedBytesIndependentOfHost!==true||
  manifest.networkPermissionIndependentlyAuthenticatedClaimed!==true||
  manifest.networkTrafficProductionOriginTouched!==false)
  return no('blocked-host-custody','Missing externally authorized isolated host receipt and source scope.');
 if(!Array.isArray(manifest.files)||manifest.files.length!==A9.ASSETS.length||
  !bytes||typeof bytes!=='object')return no('blocked-host-files','Eight bounded original response buffers required.');
 const seen=new Set(),digests=[];
 for(const r of manifest.files){
  if(!r||!A9.ASSETS.includes(r.path)||seen.has(r.path)||
    r.requestMethod!=='GET'||r.httpStatus!==200||r.redirected!==false||
    r.credentialsSent!==false||r.responseUrl!==new URL(r.path,manifest.origin).toString()||
    !Number.isSafeInteger(r.byteLength)||r.byteLength<1||r.byteLength>10*1024*1024||
    !Buffer.isBuffer(bytes[r.path])||bytes[r.path].length!==r.byteLength||
    sha(bytes[r.path])!==r.sha256||
    sha(bytes[r.path])!==require('./a15-public-archive-observation.json').a9.assetByteHashes[r.path]){
   return no('blocked-host-file-integrity','Wrong original response bytes, URL, redirection or source checksum.');
  }
  seen.add(r.path);digests.push({path:r.path,hash:r.sha256});
 }
 if(Object.keys(bytes).length!==8||!A9.ASSETS.every(x=>seen.has(x))||
  manifest.responseSetDigest!==A18.hash(digests.sort((a,b)=>a.path.localeCompare(b.path))))
  return no('blocked-host-manifest','Unknown extra file or changed canonical response identity.');
 const payload={kind:'host-byte-intake',sourceSha:LOCK.sourceSha,a18Head:PINS.a18Head,
  deploymentId:manifest.deploymentId,challengeDigest:manifest.challengeDigest,
  evidenceDigest:A18.hash(manifest),responseSetDigest:manifest.responseSetDigest};
 const att=A18.verify({kind:'host-byte-intake',payload,envelope:signature,roots,now});
 return att.status==='signed-originals-document-only'
  ?no('host-original-bytes-reviewable','Exact eight supplied HTTP body bytes match original A9 hashes and document signature; independent human/host provenance still unverified.',
    {originalHostBytesChecked:8,originalsDigest:A18.hash(payload)})
  :att;
}
function localArtifact({original,bytes,expectedSHA256}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>50*1024*1024||
  !HEX.test(expectedSHA256||'')||sha(bytes)!==expectedSHA256)
  return no('blocked-artifact','Original ZIP/archive bytes missing or mismatch.');
 if(!original||original.format!=='GomokuA19ArchiveCopy'||original.a18Head!==PINS.a18Head||
  original.sha256!==expectedSHA256||original.bytes!==bytes.length||
  original.operatorClaimsHumanReview!==false)
  return no('blocked-archive-provenance','Archive needs original source, size and explicitly NO human approval.');
 return no('archive-hash-match-only','Exact original artifact bytes match SHA-256; chain-of-custody signer still unverified.',
  {sha256:expectedSHA256,bytes:bytes.length});
}
module.exports={originalHost,localArtifact,no,sha,base};
