/* A18 real-host intake contract: fail-closed external proof review, no automatic GET. */
'use strict';
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json'),A10=require('./a10-preview-integrity.cjs');
const A17=require('./a17-preview-collector.cjs'),G=require('./a17-operator-gate.cjs');
const W=require('./a18-signer-reconciliation.cjs');
const PIN=require('./a18-source-pins.json'),A15=require('./a15-public-archive-observation.json');
const HEX=/^[0-9a-f]{64}$/;
function inspect({candidate,scope,approvalOptIn=false,operatorCapture,originals,signature,roots,now=new Date()}={}){
 if(candidate?.sourceSha!==LOCK.sourceSha||candidate.sourceBranch!==LOCK.upstreamBranch||
  String(candidate.workflowRunId)!==LOCK.githubRunId||!A9.automated(candidate).ok||
  A9.ASSETS.some(p=>candidate.assets?.[p]!==A15.a9.assetByteHashes[p])||
  PIN.a9NestedSHA256!==LOCK.offlineZipSha256||PIN.upstreamA17!=='92cc778bb415ce8e7157d386f29e44056c5f9397')
  return W.result('blocked-source','Original A9 source, CI stage or exact eight asset bytes not reconciled.');
 const host=operatorCapture?.origin;
 const gate=G.validate({approval:scope,approved:approvalOptIn,operation:'preview-read',targetOrigin:host,now});
 if(gate.status!=='scoped-document-only')return W.result('blocked-permission','No independently confirmed operator scope for exact candidate host.');
 try{
  const u=A10.previewUrl(host);
  if(u.toString()!==host||u.port)throw Error('Wrong HTTPS origin');
 }catch{return W.result('blocked-origin','Host must be exact isolated https://…vercel.app/ with default 443 and no redirect.')}
 if(operatorCapture?.status!=='preview-bytes-observed-unsigned'||
  operatorCapture.sourceSha!==LOCK.sourceSha||
  operatorCapture.originalZipSha256!==LOCK.offlineZipSha256||
  operatorCapture.actualHostedAccepted!==false||
  operatorCapture.approvalScopeDigest!==gate.scopeDigest||
  !Array.isArray(operatorCapture.assets)||operatorCapture.assets.length!==8||
  new Set(operatorCapture.assets.map(x=>x.path)).size!==8||
  !A9.ASSETS.every(p=>operatorCapture.assets.some(x=>x.path===p&&
    x.sha256===candidate.assets[p]&&Number.isSafeInteger(x.bytes)&&x.bytes>0))||
  operatorCapture.bytesDigest!==W.hash({origin:host,assets:operatorCapture.assets}) &&
  /* A17 uses the SHA256 of JSON.stringify bytes, not canonical object hashing. */
  operatorCapture.bytesDigest!==require('node:crypto').createHash('sha256').update(
   JSON.stringify({origin:host,assets:operatorCapture.assets})).digest('hex'))
  return W.result('blocked-capture','Unsigned original response-byte receipt is incomplete, tampered, or tied to a different scoped operator.');
 if(originals?.format!=='GomokuA18HostOriginals'||originals.version!==18||
  originals.origin!==host||originals.originalSourceSha!==LOCK.sourceSha||
  originals.a17Head!==PIN.upstreamA17||
  originals.offlineZipSha256!==LOCK.offlineZipSha256||
  originals.observationDigest!==W.hash(operatorCapture)||
  originals.networkMethod!=='GET-only-no-redirect-no-credentials'||
  originals.artifactBytesPreservedIndependently!==true||
  !HEX.test(originals.preservedOriginalsSha256||'')||
  originals.assetCount!==8||
  originals.productionOriginTouched!==false)
  return W.result('blocked-originals','Separately retained original HTTPS byte custody and safe network provenance not witnessed.');
 const v=W.verify({kind:'host-byte-intake',payload:originals,envelope:signature,roots,now});
 return v.status==='signed-originals-document-only'
  ?W.result('hosted-originals-ready-for-independent-human-review',
    'Source-bound host and reviewed-signature documents consistent, but real hosted HTTPS authorization and original witness identity must be independently authenticated.',
    {sourceSha:LOCK.sourceSha,origin:host,assetCount:8,hostedApproved:false})
  :v;
}
module.exports={inspect};
