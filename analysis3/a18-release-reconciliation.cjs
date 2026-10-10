/* A18 independent replay chronology/key revocation and separate release-closure reviewer decision desk. */
'use strict';
const W=require('./a18-signer-reconciliation.cjs'),A17=require('./a17-external-custody.cjs');
const LOCK=require('./a10-source-lock.json'),PINS=require('./a18-source-pins.json');
const SHA=/^[a-f0-9]{64}$/;
function ledger({a17Review,local,external,signatures,roots,now=new Date()}={}){
 if(a17Review?.status!=='independent-custody-documents-ready-for-human-review'||
  a17Review.replayConsumptionIndependentlyCertified!==false||
  !external||external.format!=='GomokuA18ExternalLedgerReview'||external.version!==18||
  external.repository!=='thiepn/gomoku'||external.sourceSha!==LOCK.sourceSha||
  external.a17Head!==PINS.upstreamA17||external.localHead!==local?.head||
  !SHA.test(external.providerRootDigest||'')||!SHA.test(external.remoteObjectDigest||'')||
  external.providerRootDigest===local.head||external.providerRootDigest===external.remoteObjectDigest||
  external.writePolicy!=='independently-operated-append-only-claimed'||
  external.previousEpochRevocationsReviewed!==true||
  external.replayNonceNeverReissuedClaimed!==true||
  external.originalProviderAuditLogPreservedClaimed!==true||
  external.personalPlayerDataIncluded!==false||
  !Array.isArray(external.events)||external.events.length<2)
  return W.result('blocked-external-ledger','Independent append-only original/provider chronology or source scope missing.');
 const known=local.entries.map(x=>x.digest),seen=new Set();
 for(let i=0;i<external.events.length;i++){
  const e=external.events[i];
  if(!e||!SHA.test(e.eventDigest||'')||seen.has(e.eventDigest)||
   e.localRecordDigest!==known[i]||e.sequence!==i+1||
   !W.utc(e.observedAt)||i&&Date.parse(e.observedAt)<=Date.parse(external.events[i-1].observedAt))
   return W.result('blocked-ledger-history','Provider event order, local record binding, timestamps or global nonce chronology mismatch.');
  seen.add(e.eventDigest);
 }
 if(external.events.length!==known.length)return W.result('blocked-ledger-history','External snapshot omits or adds journal records.');
 const payload={sourceSha:LOCK.sourceSha,a17Head:PINS.upstreamA17,
  localLedgerHead:local.head,externalDocumentDigest:W.hash(external),
  remoteObjectDigest:external.remoteObjectDigest,providerRootDigest:external.providerRootDigest};
 const v=W.verify({kind:'external-replay-ledger',payload,envelope:signatures,roots,now});
 return v.status==='signed-originals-document-only'
  ?W.result('ledger-documentary-only','Two independent-role signatures validate this external ledger document, but real append-only provider authority and live global replay protection remain unverified.',
    {sourceSha:LOCK.sourceSha,providerDigest:external.providerRootDigest,independentReplayAuthority:false})
  :v;
}
function release({source,host,physical,restore,replay,rotation,a12,decision,roots,now=new Date()}={}){
 const necessary=[
 source?.status==='original-ci-bytes-ready-for-independent-review',
 host?.status==='hosted-originals-ready-for-independent-human-review',
 physical?.status==='physical-originals-ready-for-independent-review',
 restore?.status==='prior-static-restore-documentary-review',
 replay?.status==='ledger-documentary-only',
 rotation?.status==='ready-for-human-key-rotation-review',
 a12?.status==='manual-review-only',a12?.canDeployProduction===false];
 if(necessary.some(x=>!x))return W.result('blocked-release-gates','Originals, physical review, distinct prior image, external custody, key history or A12 preflight missing.');
 const payload=decision?.payload;
 if(!payload||payload.state!=='owner-proposal-awaits-original-human-consent'||
  payload.sourceSha!==LOCK.sourceSha||payload.a17Head!==PINS.upstreamA17||
  payload.physicalCasesReviewable!==18||payload.realPhysicalAcceptanceGranted!==false||
  !SHA.test(payload.releasePacketDigest||'')||
  payload.productionCutoverExecuted!==false||
  payload.deploymentId!==decision.envelope?.deploymentId)
  return W.result('blocked-owner-decision','Pre-cutover source and human operator proposal scope missing or conflated with production execution.');
 const v=W.verify({kind:'precutover-owner-review',payload,envelope:decision.envelope,roots,now});
 return v.status==='signed-originals-document-only'
  ?W.result('release-proposal-only','Signed human-review-shaped packet is NOT an independently authenticated owner decision, release approval or deployment authorization.')
  :v;
}
function closure({releaseProposal,cutover,stability,physicalAfter,ledgerAfter,decision,roots,now=new Date()}={}){
 if(releaseProposal?.status!=='release-proposal-only'||
  cutover?.status!=='completed-production-cutover'||
  cutover.originalHumanAuthorizationIndependentlyVerified!==true||
  cutover.productionDataMigration!=='none'||
  cutover.sourceSha!==LOCK.sourceSha||
  !W.utc(cutover.deployedAt)||!cutover.deploymentId||
  stability?.status!=='ready-for-manual-stability-review'||
  !Number.isSafeInteger(stability.hoursObserved)||stability.hoursObserved<24||stability.hoursObserved>72||
  physicalAfter?.status!=='independently-reviewed-real-device-originals'||
  ledgerAfter?.status!=='ledger-documentary-only')
  return W.result('blocked-postrelease','Actual A12 cutover, 24–72h real A13 SLO, hardware and custody review are not independently present.');
 if(!decision||decision.payload?.state!=='postrelease-owner-closure-review-only'||
  decision.payload?.deploymentId!==cutover.deploymentId||
  decision.payload?.sourceSha!==LOCK.sourceSha||
  decision.payload?.stabilityHours!==stability.hoursObserved||
  decision.envelope?.deploymentId!==cutover.deploymentId||
  !W.utc(decision.payload.reviewedAt)||Date.parse(decision.payload.reviewedAt)<=Date.parse(cutover.deployedAt))
  return W.result('blocked-closure-packet','Owner postrelease review cannot be reused from the precutover proposal.');
 const v=W.verify({kind:'postrelease-closure-review',payload:decision.payload,envelope:decision.envelope,roots,now});
 return v.status==='signed-originals-document-only'
  ?W.result('closure-proposal-only','Separate signed postrelease closure-shaped packet; independent original human closure and actual operation still required.')
  :v;
}
function defaultReport(){
 const gaps=[
  ['hosted-originals','OPEN','Authorized live HTTPS preview has not been verified'],
  ['physical-android-chrome','0/7','Real original Android Chrome acceptance absent'],
  ['physical-samsung-internet','0/6','Real original Samsung Internet acceptance absent'],
  ['physical-installed-pwa','0/5','Real installed PWA acceptance absent'],
  ['accessibility','OPEN','Independent screen reader, 200% zoom, focus and offline observation absent'],
  ['sw-update-and-rollback','OPEN','Original real same-origin update and prior stable restore absent'],
  ['external-custody-signers','OPEN','No real trusted public keys, revocation chain or administered replay ledger'],
  ['a12-cutover','NOT EXECUTED','Separate actual owner-authorized production release absent'],
  ['a13-monitoring','NOT OBSERVED','Real 24–72h postrelease P20 evidence absent']
 ];
 return W.result('HOLD','No auto-approval or real-world acceptance inferred from source code, CI or fixture reports.',
  {gaps,originalRealPhysicalCases:0,releaseAuthorized:false,actualHumanSignatures:false});
}
if(require.main===module)console.log(JSON.stringify(defaultReport(),null,2));
module.exports={ledger,release,closure,defaultReport};
