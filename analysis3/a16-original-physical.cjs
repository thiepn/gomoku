/* A16: preflight hosted HTTPS, A11 physical/SW and rollback originals, then independent documentary witness. */
'use strict';
const A9=require('./rc9-core.cjs'),LOCK=require('./a10-source-lock.json');
const A10=require('./a10-preview-integrity.cjs');
const A11=require('./a11-release-admission.cjs');
const SOURCE=require('./a15-public-evidence.cjs');
const OBS=require('./a15-public-archive-observation.json');
const CUSTODY=require('./a16-independent-custody.cjs');
const sha=CUSTODY.digest;
const H64=/^[a-f0-9]{64}$/;
function blocked(status,detail,extra={}){return CUSTODY.output(status,detail,extra);}
function source({candidate,github,offlineZip,observed=OBS}={}){
 if(!candidate||candidate.sourceSha!==LOCK.sourceSha||
  candidate.sourceBranch!==LOCK.upstreamBranch||
  String(candidate.workflowRunId)!==LOCK.githubRunId||!A9.automated(candidate).ok||
  !A9.ASSETS.every(x=>H64.test(candidate.assets?.[x]||'')))
  return blocked('blocked-a9-source','Original immutable A9 seven CI stages and source candidate absent.');
 if(!SOURCE.pinsValid()||github?.status!=='ready-for-original-byte-and-independent-review'||
  github.a9SourceSha!==LOCK.sourceSha||github.a14HeadSha!=='20ed712041029930b41fd76e5c895a6f43c29e1d'||
  !Array.isArray(github.validatedRuns)||!Array.isArray(github.validatedArtifacts)||
  !github.validatedRuns.includes(Number(LOCK.githubRunId))||
  !require('./a15-evidence-pins.json').requiredRuns.every(x=>github.validatedRuns.includes(x.id)))
  return blocked('blocked-github','Original run and six A14 exact-head GitHub readbacks missing or stale.');
 if(offlineZip?.status!=='ready-for-independent-zip-review'||offlineZip.offlineZipSha256!==LOCK.offlineZipSha256)
  return blocked('blocked-offline','Original nested ZIP byte evidence not observed.');
 if(observed?.format!=='GomokuA15ReadOnlyObservedArtifactBytes'||
  observed.a9?.sourceSha!==LOCK.sourceSha||observed.a9.nestedSha256!==LOCK.offlineZipSha256||
  observed.a9.artifactZipSha256!==require('./a15-evidence-pins.json').a9Artifact.digest.slice(7)||
  observed.a9.checkedAssets!==8||observed.a9.matchedAssets!==8||
  observed.a9.candidateSourceSha!==LOCK.sourceSha||
  Object.keys(observed.a9.assetByteHashes||{}).length!==8||
  !A9.ASSETS.every(x=>observed.a9.assetByteHashes[x]===candidate.assets[x])||
  observed.independentHumanReview!==false||observed.releaseAuthorization!==false||
  observed.physicalDeviceEvidence!==false)
  return blocked('blocked-artifact-original','A15 original downloaded public CI bytes do not match the original immutable A9 candidate.');
 return blocked('original-ci-bytes-ready-for-independent-review','Original publicly downloaded A9 archive, nested ZIP and eight actual asset digests reconcile; hosted HTTPS and human acceptance still OPEN.',
  {originalSourceSha:LOCK.sourceSha,offlineZipSha256:LOCK.offlineZipSha256});
}
function hosted({candidate,worksheet,probe,controlledUpdate,rollback,a11,witness,roots}={}){
 if(!candidate||candidate.sourceSha!==LOCK.sourceSha||!A9.automated(candidate).ok)
  return blocked('blocked-a9-source','Original A9 source evidence missing.');
 if(!probe||!Array.isArray(probe.verifiedAssets)||probe.verifiedAssets.length!==8)
  return blocked('blocked-hosted-https','No separately verified live HTTPS response-byte receipt.');
 try{A10.previewUrl(probe.url);}catch{return blocked('blocked-hosted-https','Preview must be dedicated nonproduction .vercel.app HTTPS origin.');}
 if(probe.sourceSha!==LOCK.sourceSha||probe.archiveSha256!==LOCK.offlineZipSha256)
  return blocked('blocked-hosted-https','Preview source or package hash drift.');
 const seen=new Set();
 for(const e of probe.verifiedAssets){
  if(!e||!A9.ASSETS.includes(e.path)||seen.has(e.path)||
    !Number.isSafeInteger(e.bytes)||e.bytes<1||e.sha256!==candidate.assets[e.path])
   return blocked('blocked-hosted-https','Duplicate/incorrect original asset byte receipt.');
  seen.add(e.path);
 }
 const physical=A9.physical(candidate,worksheet);
 if(!physical.ok)return blocked('blocked-physical','Physical A11 worksheet lacks authenticated original 7/6/5 device observations.',
   {missingCases:physical.issues});
 const sw=A11.checkUpdate(controlledUpdate,candidate,probe);
 if(sw.length)return blocked('blocked-sw-update','Actual independently observed same-origin service-worker update and reversal unqualified.');
 const recovery=A11.checkRollback(rollback,candidate);
 if(recovery.length)return blocked('blocked-rollback','Previous-stable recovery and independently witnessed preview rollback evidence missing.');
 const audit=A11.audit({candidate,worksheet,probe,updateEvidence:controlledUpdate,rollbackEvidence:rollback});
 if(a11?.format!=='GomokuAnalysis3A11Admission'||a11.version!==11||
  a11.status!=='ready-for-independent-release-review'||
  a11.sourceSha!==LOCK.sourceSha||a11.offlineZipSha256!==LOCK.offlineZipSha256||
  a11.physicalCases?.required!==18||a11.physicalCases?.passed!==18||
  audit.status!=='ready-for-independent-release-review'||
  a11.canMerge!==false||a11.canDeployProduction!==false)
  return blocked('blocked-a11-owner','Independent A11 original owner evidence admission absent.');
 const payload={candidate,worksheet,probe,controlledUpdate,rollback,a11};
 if(witness?.kind!=='physical-acceptance'||
  witness.productionCommitSha!==witness.payload?.productionCommitSha||
  witness.payload?.sourceSha!==LOCK.sourceSha||
  witness.payload?.previewOrigin!==probe.url||witness.payload?.originalsDigest!==sha(payload)||
  witness.payload?.physicalCases!==18)
  return blocked('blocked-witness','Separate original physical/host/rollback witness attribution absent.');
 const verified=CUSTODY.verifySigned({envelope:witness,kind:'physical-acceptance',payload:witness.payload,
  rolesRequired:['independent-evidence-reviewer'],roots});
 return verified.status==='signed-documents-only'
  ?blocked('ready-for-independent-original-physical-review','Signed documentary physical acceptance matches original A11 receipts. Real devices, original bytes, witness key and owner must still be authenticated externally.',
   {physicalCases:18,observedPreviewOrigin:probe.url})
  :verified;
}
module.exports={source,hosted};
