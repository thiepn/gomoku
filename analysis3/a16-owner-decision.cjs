/* A16: separate source-bound owner cutover vs operational closure decisions. No execution. */
'use strict';
const A15=require('./a15-operator-closure.cjs');
const A16=require('./a16-independent-custody.cjs');
const LOCK=require('./a10-source-lock.json'),PINS=require('./a15-evidence-pins.json');
const A13=require('./a13-stability-audit.cjs');
const SHA=/^[0-9a-f]{64}$/;
function denied(status,reason,extra={}){return A16.output(status,reason,extra);}
function rotation({current,proposal,review,witness,roots}={}){
 const preliminary=A15.rotation({current,proposal,review});
 if(preliminary.status!=='ready-for-external-key-review')
  return denied('blocked-rotation','A15 previous-key identity, monotonically revoked roles and independent change-ticket review not qualified.');
 if(witness?.kind!=='key-rotation'||
  witness.payload?.priorPolicyDigest!==proposal.priorPolicyDigest||
  witness.payload?.proposedPolicyDigest!==preliminary.proposedPolicyDigest||
  witness.payload?.changeEvidenceDigest!==proposal.changeEvidenceDigest||
  witness.payload?.a15HeadSha!=='df2b958494460d650574351472770458e5ab5f62')
  return denied('blocked-rotation-witness','Independent proposal/source fingerprint rotation witness missing.');
 const x=A16.verifySigned({envelope:witness,kind:'key-rotation',payload:witness.payload,
  rolesRequired:['external-ledger-custodian','independent-evidence-reviewer'],roots});
 return x.status==='signed-documents-only'
  ?denied('rotation-ready-for-separate-operator-review','Two-role signed documentary fingerprints appear consistent; no key provisioning, rotation, owner consent or global revocation has been executed.',
    {proposalDigest:preliminary.proposedPolicyDigest})
  :x;
}
function releaseDecision({source,physical,replay,rotationReview,a12,decision,roots}={}){
 if(source?.status!=='original-ci-bytes-ready-for-independent-review'||
  source.originalSourceSha!==LOCK.sourceSha||
  source.offlineZipSha256!==require('./a10-source-lock.json').offlineZipSha256)
  return denied('blocked-source','Public original A9/CI asset byte readback not reconciled.');
 if(physical?.status!=='ready-for-independent-original-physical-review'||
  physical.physicalCases!==18)
  return denied('blocked-physical','A11 hosted preview and all eighteen original physical tests not independently witnessed.');
 if(replay?.status!=='ready-for-external-ledger-review'||!SHA.test(replay.ledgerHead||''))
  return denied('blocked-replay','Independently signed source-bound challenge observation and its externally governed ledger required.');
 if(rotationReview?.status!=='rotation-ready-for-separate-operator-review')
  return denied('blocked-rotation','Externally witnessed reviewed owner and signer key rotation required.');
 if(a12?.format!=='GomokuAnalysis3A12Preflight'||a12.sourceSha!==LOCK.sourceSha||
  a12.status!=='manual-review-only'||a12.canDeployProduction!==false||
  a12.canMerge!==false||a12.canTag!==false)
  return denied('blocked-a12','A12 explicit independent owner production-cutover preflight not complete.');
 if(decision?.kind!=='release-decision'||
  decision.payload?.state!=='review-proposed-only'||
  decision.payload?.sourceSha!==LOCK.sourceSha||
  decision.payload?.a12HeadSha!=='e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07'||
  decision.payload?.a15HeadSha!=='df2b958494460d650574351472770458e5ab5f62'||
  decision.payload?.originalZipSha256!==LOCK.offlineZipSha256||
  decision.payload?.challenge!==replay.challenge||
  decision.payload?.ledgerHead!==replay.ledgerHead||
  decision.payload?.physicalCases!==18||
  decision.payload?.productionOrigin!==decision.productionOrigin)
  return denied('blocked-owner-release-decision','Owner release consideration is absent, stale, conflated with closure, or lacks witnessed originals.');
 const v=A16.verifySigned({envelope:decision,kind:'release-decision',payload:decision.payload,
  rolesRequired:['independent-evidence-reviewer','release-owner'],roots});
 return v.status==='signed-documents-only'
  ?denied('ready-for-separate-human-release-decision','Signed *proposal to review* only, never a production authorization or deployment. An actual separate human-operated release change remains required.')
  :v;
}
function operationalClosure({release,cutover,stability,independentLedger,ownerClosure,roots}={}){
 if(release?.status!=='ready-for-separate-human-release-decision')
  return denied('blocked-release','Missing separately reviewed A16 release-decision proposal.');
 if(cutover?.format!=='GomokuAnalysis3A13ExecutedCutover'||
  cutover.status!=='completed-production-cutover'||cutover.sourceSha!==LOCK.sourceSha||
  cutover.productionDataMigration!=='none'||cutover.rollbackAvailable!==true||
  typeof cutover.deployedAt!=='string'||!Number.isFinite(Date.parse(cutover.deployedAt)))
  return denied('blocked-cutover','No actually executed, separately authorized A12 cutover and independently reviewed production record.');
 if(stability?.format!=='GomokuAnalysis3A13StabilityReview'||
  stability.status!=='ready-for-manual-stability-review'||
  stability.sourceSha!==LOCK.sourceSha||stability.canCloseRelease!==false||
  !Number.isSafeInteger(stability.hoursObserved)||stability.hoursObserved<24||
  stability.hoursObserved>72)
  return denied('blocked-stability','Actual 24–72h independently monitored production evidence and final physical handoff missing.');
 if(independentLedger?.status!=='ready-for-external-ledger-review'||
  !SHA.test(independentLedger.ledgerHead||''))
  return denied('blocked-replay','Owner operational closure cannot reuse unanchored source-only replay claims.');
 if(ownerClosure?.kind!=='operational-closure'||
  ownerClosure.payload?.state!=='closure-review-only'||
  ownerClosure.payload?.sourceSha!==LOCK.sourceSha||
  ownerClosure.payload?.ledgerHead!==independentLedger.ledgerHead||
  ownerClosure.payload?.deploymentId!==cutover.deploymentId||
  ownerClosure.payload?.productionCommitSha!==cutover.productionCommitSha||
  ownerClosure.payload?.stabilityHours!==stability.hoursObserved||
  ownerClosure.payload?.productionOrigin!==cutover.productionOrigin||
  !Number.isFinite(Date.parse(ownerClosure.payload?.reviewedAt||''))||
  Date.parse(ownerClosure.payload.reviewedAt)<Date.parse(cutover.deployedAt))
  return denied('blocked-closure-owner','Independent second post-release owner closure proposal absent or invalid.');
 const v=A16.verifySigned({envelope:ownerClosure,kind:'operational-closure',
  payload:ownerClosure.payload,
  rolesRequired:['independent-evidence-reviewer','release-owner'],roots});
 return v.status==='signed-documents-only'
  ?denied('ready-for-separate-human-operational-closure','Separate owner/reviewer signature-shaped postrelease closure proposal matches documentary scope only; no actual owner closure or publication granted.')
  :v;
}
if(require.main===module){console.log(JSON.stringify(releaseDecision(),null,2));process.exitCode=2;}
module.exports={rotation,releaseDecision,operationalClosure};
