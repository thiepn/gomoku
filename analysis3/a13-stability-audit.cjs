/* A13 — read-only, documentary post-release stability audit. NEVER a release or closure authorization. */
'use strict';
const fs=require('node:fs');
const A9=require('./rc9-core.cjs');
const LOCK=require('./a10-source-lock.json');
const A12=require('./a12-cutover-preflight.cjs');
const H40=/^[a-f0-9]{40}$/i,H64=/^[a-f0-9]{64}$/i;
const nonempty=v=>typeof v==='string'&&v.trim().length>0;
const instant=v=>nonempty(v)&&Number.isFinite(Date.parse(v))&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&/(Z|\+00:00)$/.test(v);
const ts=v=>Date.parse(v);
const after=(a,b)=>instant(a)&&instant(b)&&ts(a)>=ts(b);
const DEVICE={
 'android-chrome':['launch','offline','saved-records','online-match','accessibility'],
 'samsung-internet':['launch','offline','saved-records','online-match','accessibility'],
 'installed-pwa':['launch','offline','saved-records','online-match','accessibility','same-origin-sw-update','reinstall-data-survival']
};
function result(status,issue,extra={}){
 return {format:'GomokuAnalysis3A13StabilityReview',version:13,sourceSha:LOCK.sourceSha,
  status,issue,...extra,canCertifyStable:false,canCloseRelease:false,
  canMerge:false,canTag:false,canDeployProduction:false,canChangeProductionData:false,
  notice:'Independent review of original evidence, GitHub and HTTPS is essential. This offline schema is not authoritative human acceptance.'};
}
function assetChecks(assets,expected){
 if(!Array.isArray(assets)||assets.length!==A9.ASSETS.length)return false;
 const names=new Set();
 for(const a of assets){
  if(!a||!A9.ASSETS.includes(a.path)||names.has(a.path)||
    a.sha256!==expected?.[a.path]||!Number.isSafeInteger(a.bytes)||a.bytes<1)
   return false;
  names.add(a.path);
 }
 return A9.ASSETS.every(x=>names.has(x));
}
function telemetryCheck(t,cutover){
 if(t?.format!=='GomokuAnalysis3A13P20Telemetry'||t.source!=='p20-production'||
   t.deploymentId!==cutover.deploymentId||t.origin!==cutover.productionOrigin||
   !H64.test(t.evidenceDigest||'')||!nonempty(t.collector)||!instant(t.collectedAt)||
   !Array.isArray(t.samples)||t.samples.length<24||t.samples.length>72)
  return {ok:false,reason:'P20 source, aggregate data, immutable evidence digest, or 24–72 samples missing.'};
 const hour=3_600_000,first=ts(t.samples[0]?.start);
 if(!Number.isFinite(first)||first<ts(cutover.deployedAt)||
   first-ts(cutover.deployedAt)>2*hour)
  return {ok:false,reason:'Stability window must begin within two hours after actual deployment.'};
 let requests=0,failed=0,persist=0,persistMiss=0,recovery=0,recoveryMiss=0,clean=0,alerts=0;
 for(let i=0;i<t.samples.length;i++){
  const s=t.samples[i],start=ts(s?.start);
  if(!instant(s?.start)||!Number.isFinite(start)||!/T\d{2}:00:00(?:\.000)?Z$/.test(s.start)||
     start!==first+i*hour)
   return {ok:false,reason:'Missing, duplicated, out-of-order or non-hourly telemetry bucket at '+i};
  for(const k of ['requests','failed','persistenceChecks','persistenceMisses',
     'recoveryChecks','recoveryMisses','cleanMinutes','criticalAlerts'])
   if(!Number.isSafeInteger(s[k])||s[k]<0)return {ok:false,reason:'Invalid counter: '+k+' at '+i};
  if(s.failed>s.requests||s.persistenceMisses>s.persistenceChecks||
     s.recoveryMisses>s.recoveryChecks||s.cleanMinutes>60)
   return {ok:false,reason:'Impossible hourly telemetry values at '+i};
  requests+=s.requests;failed+=s.failed;persist+=s.persistenceChecks;
  persistMiss+=s.persistenceMisses;recovery+=s.recoveryChecks;
  recoveryMiss+=s.recoveryMisses;clean+=s.cleanMinutes;alerts+=s.criticalAlerts;
 }
 const end=first+t.samples.length*hour;
 if(!after(t.collectedAt,new Date(end).toISOString())||
   t.windowStart!==new Date(first).toISOString()||
   t.windowEnd!==new Date(end).toISOString())
  return {ok:false,reason:'Stability window bounds or collection time do not match samples.'};
 if(requests===0||persist===0||recovery===0)
  return {ok:false,reason:'No observed requests or persistence/recovery probes; cannot certify an unobserved service.'};
 const ratios={availability:1-failed/requests,persistence:1-persistMiss/persist,
  recovery:1-recoveryMiss/recovery,runtime:clean/(60*t.samples.length)};
 if(alerts!==0||ratios.availability<0.999||ratios.persistence<0.999||
     ratios.recovery<0.999||ratios.runtime<0.99)
  return {ok:false,reason:'P20 error-budget, critical-alert or runtime-clean-minute threshold exceeded.',ratios};
 return {ok:true,ratios,end:new Date(end).toISOString(),hours:t.samples.length};
}
function verifyDevices(d,cutover,candidate){
 if(d?.format!=='GomokuAnalysis3A13PhysicalFollowup'||d.origin!==cutover.productionOrigin||
   d.deploymentId!==cutover.deploymentId||d.sourceSha!==LOCK.sourceSha||
   !H64.test(d.evidenceDigest||'')||!Array.isArray(d.devices)||d.devices.length!==3)
  return 'Production post-release physical device packet missing or wrong deployment.';
 const seen=new Set();
 for(const row of d.devices){
  if(!row||!Object.hasOwn(DEVICE,row.platform)||seen.has(row.platform)||
    !nonempty(row.device)||!nonempty(row.osVersion)||!nonempty(row.browserVersion)||
    !nonempty(row.tester)||!after(row.observedAt,cutover.deployedAt)||
    row.indexSha256!==candidate.assets['index.html']||
    row.serviceWorkerSha256!==candidate.assets['sw.js']||
    !H64.test(row.originalObservationDigest||'')||!Array.isArray(row.cases)||
    row.cases.length!==DEVICE[row.platform].length)
   return 'Incomplete actual post-release physical platform observations.';
  seen.add(row.platform);
  const cases=new Set();
  for(const test of row.cases){
   if(!test||!DEVICE[row.platform].includes(test.id)||cases.has(test.id)||
      test.status!=='passed'||!nonempty(test.observation)||
      test.observation.length<20||!H64.test(test.evidenceDigest||''))
    return 'Missing or duplicated physical case evidence for '+row.platform;
   cases.add(test.id);
  }
  if(DEVICE[row.platform].some(x=>!cases.has(x)))
   return 'Missing physical test case on '+row.platform;
 }
 return DEVICE&&Object.keys(DEVICE).every(x=>seen.has(x))?null:'Missing required physical platform.';
}
function audit({candidate,cutover,liveProbe,telemetry,devices,incidents,handoff}={}){
 if(candidate?.sourceSha!==LOCK.sourceSha||candidate.sourceBranch!==LOCK.upstreamBranch||
    String(candidate.workflowRunId)!==LOCK.githubRunId||!A9.automated(candidate).ok)
  return result('blocked-source','Immutable A9 source, seven original CI stages, or A9 run absent.');
 if(!cutover||cutover.format!=='GomokuAnalysis3A13ExecutedCutover'||
   cutover.status!=='completed-production-cutover'||cutover.sourceSha!==LOCK.sourceSha||
   !H40.test(cutover.a12HeadSha||'')||!H40.test(cutover.previousMainSha||'')||
   !H40.test(cutover.productionCommitSha||'')||
   cutover.previousMainSha===cutover.productionCommitSha||
   !A12.origin(cutover.productionOrigin)||
   !nonempty(cutover.deploymentId)||!nonempty(cutover.operator)||
   !nonempty(cutover.owner)||cutover.owner===cutover.operator||
   !nonempty(cutover.independentWitness)||cutover.independentWitness===cutover.operator||
   !H64.test(cutover.a12PreflightDigest||'')||
   !H64.test(cutover.ownerAuthorizationDigest||'')||
   !H64.test(cutover.deploymentEvidenceDigest||'')||
   !instant(cutover.authorizedAt)||!after(cutover.deployedAt,cutover.authorizedAt)||
   cutover.rollbackArchiveSha256!==LOCK.offlineZipSha256||
   cutover.productionDataMigration!=='none'||cutover.rollbackAvailable!==true)
  return result('blocked-cutover','A genuinely executed, witnessed, SHA-bound and separately authorized production cutover is not documented.');
 if(!liveProbe||liveProbe.format!=='GomokuAnalysis3A13ProductionProbe'||
    liveProbe.sourceSha!==LOCK.sourceSha||liveProbe.origin!==cutover.productionOrigin||
    liveProbe.deploymentId!==cutover.deploymentId||
    !after(liveProbe.observedAt,cutover.deployedAt)||
    !H64.test(liveProbe.originalResponseDigest||'')||
    !assetChecks(liveProbe.verifiedAssets,candidate.assets))
  return result('blocked-production-integrity','Real production HTTPS eight-asset byte receipt missing, altered, redirected or from a different deployment.');
 const t=telemetryCheck(telemetry,cutover);
 if(!t.ok)return result('blocked-stability','24–72h P20 stability monitoring incomplete: '+t.reason);
 const physical=verifyDevices(devices,cutover,candidate);
 if(physical)return result('blocked-physical',physical,{hoursObserved:t.hours});
 if(!incidents||incidents.format!=='GomokuAnalysis3A13IncidentReview'||
    incidents.deploymentId!==cutover.deploymentId||
    !after(incidents.reviewedAt,t.end)||!nonempty(incidents.independentReviewer)||
    incidents.independentReviewer===cutover.operator||
    !H64.test(incidents.incidentJournalDigest||'')||
    !H64.test(incidents.alertExportDigest||'')||
    !H64.test(incidents.rollbackReadinessDigest||'')||
    incidents.noOpenSev1OrSev2!==true||incidents.playerDataLoss!==false||
    incidents.rollBackExecuted!==false||incidents.rollbackReady!==true||
    !Array.isArray(incidents.entries)||
    incidents.entries.some(x=>!x||!['sev1','sev2','sev3','sev4'].includes(x.severity)||
     x.status!=='resolved'||!after(x.resolvedAt,cutover.deployedAt)))
  return result('blocked-incident-review','Independently reviewed P20 alerts, incident history and recoverability are missing or non-green.');
 if(!handoff||handoff.format!=='GomokuAnalysis3A13OperationalHandoff'||
   handoff.deploymentId!==cutover.deploymentId||
   handoff.status!=='accepted-by-owner-for-independent-review'||
   !after(handoff.acceptedAt,incidents.reviewedAt)||
   !nonempty(handoff.owner)||handoff.owner!==cutover.owner||
   !nonempty(handoff.independentReviewer)||handoff.independentReviewer===cutover.operator||
   handoff.independentReviewer===handoff.owner||
   !nonempty(handoff.onCall)||!nonempty(handoff.escalation)||
   !nonempty(handoff.supportRunbook)||!H64.test(handoff.supportRunbookDigest||'')||
   !H64.test(handoff.ownerSignatureEvidenceDigest||'')||
   !H64.test(handoff.independentReviewEvidenceDigest||''))
  return result('blocked-handoff','Owner and independent reviewer operational handoff incomplete or not chronologically attributable.');
 return result('ready-for-manual-stability-review',
  'Structurally complete documents only, not independently authenticated and never an automated stable-release certification.',
  {hoursObserved:t.hours,observedSloRatios:t.ratios,physicalPlatforms:Object.keys(DEVICE)});
}
function load(f){return f?JSON.parse(fs.readFileSync(f,'utf8')):null}
if(require.main===module){
 const [candidate,cutover,liveProbe,telemetry,devices,incidents,handoff]=process.argv.slice(2);
 const r=audit({candidate:load(candidate),cutover:load(cutover),liveProbe:load(liveProbe),
  telemetry:load(telemetry),devices:load(devices),incidents:load(incidents),handoff:load(handoff)});
 console.log(JSON.stringify(r,null,2));
 if(r.status!=='ready-for-manual-stability-review')process.exitCode=2;
}
module.exports={audit,telemetryCheck,verifyDevices,assetChecks,DEVICE};
