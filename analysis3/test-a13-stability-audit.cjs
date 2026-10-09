'use strict';
const assert=require('node:assert/strict');
const Audit=require('./a13-stability-audit.cjs'),A9=require('./rc9-core.cjs');
const LOCK=require('./a10-source-lock.json');
const h='a'.repeat(64),p='b'.repeat(64),q='c'.repeat(64);
const orig='https://gomoku.thiepn.dev/';
const dep='synthetic-deployment-not-real';
const begin=Date.parse('2026-10-01T01:00:00.000Z'),hour=3600000;
const iso=n=>new Date(n).toISOString();
function fixture(){
 const assets=Object.fromEntries(A9.ASSETS.map(k=>[k,k==='index.html'?h:k==='sw.js'?p:q]));
 const candidate={format:'GomokuAnalysis3Candidate',version:9,sourceBranch:LOCK.upstreamBranch,
  sourceSha:LOCK.sourceSha,originMainFrozen:true,workflowRunId:LOCK.githubRunId,assets,
  stages:Object.fromEntries(A9.STAGES.map(stage=>[stage,{status:'passed',issuer:'GitHub Actions',
   sourceSha:LOCK.sourceSha,indexSha256:h,workflowRunId:LOCK.githubRunId,
   completedAt:'2026-09-29T19:00:00Z'}]))};
 const cutover={format:'GomokuAnalysis3A13ExecutedCutover',status:'completed-production-cutover',
  sourceSha:LOCK.sourceSha,a12HeadSha:'1'.repeat(40),
  previousMainSha:'2'.repeat(40),productionCommitSha:'3'.repeat(40),
  productionOrigin:orig,deploymentId:dep,operator:'SYNTHETIC OPERATOR',
  owner:'SYNTHETIC OWNER',independentWitness:'SYNTHETIC WITNESS',
  a12PreflightDigest:h,ownerAuthorizationDigest:h,deploymentEvidenceDigest:h,
  authorizedAt:'2026-09-30T23:00:00Z',deployedAt:'2026-10-01T00:00:00Z',
  candidateArchiveSha256:LOCK.offlineZipSha256,
  previousStableArchiveSha256:'5'.repeat(64),previousStableSourceSha:'2'.repeat(40),
  previousStableRestoreTestedAt:'2026-09-30T23:30:00Z',productionDataMigration:'none',
  rollbackAvailable:true};
 const liveProbe={format:'GomokuAnalysis3A13ProductionProbe',version:13,origin:orig,
  sourceSha:LOCK.sourceSha,deploymentId:dep,observedAt:'2026-10-02T01:05:00Z',
  originalResponseDigest:h,
  verifiedAssets:A9.ASSETS.map(path=>({path,sha256:assets[path],bytes:123}))};
 const samples=Array.from({length:24},(_,i)=>({start:iso(begin+i*hour),
  sampledMinutes:60,serviceGoodMinutes:60,persistenceGoodMinutes:60,
  recoveryGoodMinutes:60,runtimeCleanMinutes:60,criticalAlerts:0}));
 const telemetry={format:'GomokuAnalysis3A13P20Telemetry',source:'p20-production',
  aggregatedFrom:'gomoku-p20-slo-sample',
  origin:orig,deploymentId:dep,evidenceDigest:h,collector:'SYNTHETIC AGGREGATE',
  windowStart:iso(begin),windowEnd:iso(begin+24*hour),
  collectedAt:'2026-10-02T02:00:00Z',samples};
 const devices={format:'GomokuAnalysis3A13PhysicalFollowup',origin:orig,
  deploymentId:dep,sourceSha:LOCK.sourceSha,evidenceDigest:h,
  devices:Object.entries(Audit.DEVICE).map(([platform,ids])=>({
   platform,device:'SYNTHETIC NOT A DEVICE',osVersion:'synthetic',browserVersion:'synthetic',
   tester:'SYNTHETIC TESTER',observedAt:'2026-10-01T20:00:00Z',
   indexSha256:h,serviceWorkerSha256:p,originalObservationDigest:h,
   cases:ids.map(id=>({id,status:'passed',observation:'Synthetic test fixture; not actual physical evidence.',
    evidenceDigest:q}))}))};
 const incidents={format:'GomokuAnalysis3A13IncidentReview',deploymentId:dep,
  reviewedAt:'2026-10-02T03:00:00Z',independentReviewer:'SYNTHETIC REVIEWER',
  incidentJournalDigest:h,alertExportDigest:h,rollbackReadinessDigest:h,
  noOpenSev1OrSev2:true,playerDataLoss:false,rollbackExecuted:false,
  rollbackReady:true,entries:[]};
 const handoff={format:'GomokuAnalysis3A13OperationalHandoff',deploymentId:dep,
  status:'accepted-by-owner-for-independent-review',acceptedAt:'2026-10-02T04:00:00Z',
  owner:'SYNTHETIC OWNER',independentReviewer:'SYNTHETIC REVIEWER',
  onCall:'SYNTHETIC',escalation:'SYNTHETIC',supportRunbook:'SYNTHETIC',
  supportRunbookDigest:h,ownerSignatureEvidenceDigest:h,independentReviewEvidenceDigest:h};
 return {candidate,cutover,liveProbe,telemetry,devices,incidents,handoff};
}
let n=0;function test(label,change,status){
 const x=fixture();if(change)change(x);
 const a=Audit.audit(x);assert.equal(a.status,status,label+': '+a.issue);
 for(const k of ['canCertifyStable','canCloseRelease','canMerge','canTag','canDeployProduction','canChangeProductionData'])
  assert.equal(a[k],false,label+': no production rights');
 n++;console.log('PASS '+label);
}
const ok='ready-for-manual-stability-review';
test('synthetic full receipt is never auto certified',null,ok);
test('immutable A9 receipt absent',x=>x.candidate=null,'blocked-source');
test('immutable A9 source changed',x=>x.candidate.sourceSha='2'.repeat(40),'blocked-source');
test('A9 automation stage missing',x=>x.candidate.stages.offline.status='skipped','blocked-source');
test('cutover cannot be omitted',x=>x.cutover=null,'blocked-cutover');
test('cutover has explicit permission source',x=>x.cutover.a12HeadSha='bad','blocked-cutover');
test('cutover owner distinct from operator',x=>x.cutover.owner=x.cutover.operator,'blocked-cutover');
test('cutover may not precede owner approval',x=>x.cutover.deployedAt='2026-09-30T22:00:00Z','blocked-cutover');
test('preview origin never passes production receipt',x=>x.cutover.productionOrigin='https://gomoku-test.vercel.app/','blocked-cutover');
test('live data migrations outside approved scope',x=>x.cutover.productionDataMigration='db-push','blocked-cutover');
test('different rollback ZIP cannot certify',x=>x.cutover.candidateArchiveSha256=q,'blocked-cutover');
test('previous stable archive is required independently from candidate',x=>x.cutover.previousStableArchiveSha256='invalid','blocked-cutover');
test('rollback source must match previous main commit',x=>x.cutover.previousStableSourceSha='3'.repeat(40),'blocked-cutover');
test('restore rehearsal cannot occur after cutover',x=>x.cutover.previousStableRestoreTestedAt='2026-10-02T00:00:00Z','blocked-cutover');
test('independent witness may not be owner',x=>x.cutover.independentWitness=x.cutover.owner,'blocked-cutover');
test('production has to differ from pre-cutover branch',x=>x.cutover.productionCommitSha=x.cutover.previousMainSha,'blocked-cutover');
test('real production HTTPS probe missing',x=>x.liveProbe=null,'blocked-production-integrity');
test('production digest fails if one file differs',x=>x.liveProbe.verifiedAssets[0].sha256=q,'blocked-production-integrity');
test('production digest fails if asset duplicate',x=>x.liveProbe.verifiedAssets[1]={...x.liveProbe.verifiedAssets[0]},'blocked-production-integrity');
test('reject wrong HTTPS evidence schema version',x=>x.liveProbe.version=12,'blocked-production-integrity');
test('source mismatch in HTTPS receipt',x=>x.liveProbe.sourceSha='b'.repeat(40),'blocked-production-integrity');
test('pre-window-end HTTPS proof does not establish 24-hour stability',x=>x.liveProbe.observedAt='2026-10-01T01:05:00Z','blocked-production-integrity');
test('stale deployment receipt cannot qualify',x=>x.liveProbe.deploymentId='prior-deployment','blocked-production-integrity');
test('no 24-hour horizon',x=>x.telemetry.samples.pop(),'blocked-stability');
test('over 72 hour horizon not permitted',x=>x.telemetry.samples=Array.from({length:73},(_,i)=>({...x.telemetry.samples[0],start:iso(begin+i*hour)})),'blocked-stability');
test('gap in hourly P20 telemetry is blocked',x=>x.telemetry.samples[4].start=iso(begin+5*hour),'blocked-stability');
test('duplicate hourly P20 sample is blocked',x=>x.telemetry.samples[1].start=x.telemetry.samples[0].start,'blocked-stability');
test('telemetry starts outside deployment admission window',x=>x.telemetry.samples[0].start='2026-10-03T01:00:00.000Z','blocked-stability');
test('impossible metric counters are rejected',x=>x.telemetry.samples[5].serviceGoodMinutes=61,'blocked-stability');
test('missing P20 minute samples cannot be certified',x=>x.telemetry.samples[1].sampledMinutes=0,'blocked-stability');
test('99.9 percent service availability enforced',x=>x.telemetry.samples[0].serviceGoodMinutes=0,'blocked-stability');
test('99.9 percent persistence enforced',x=>x.telemetry.samples[0].persistenceGoodMinutes=0,'blocked-stability');
test('99.9 percent recovery freshness enforced',x=>x.telemetry.samples[0].recoveryGoodMinutes=0,'blocked-stability');
test('99 percent runtime clean minutes enforced',x=>x.telemetry.samples[0].runtimeCleanMinutes=30,'blocked-stability');
test('missing actual P20 sampler provenance is blocked',x=>x.telemetry.aggregatedFrom='untrusted-requests','blocked-stability');
test('critical P20 alerts prevent stability review',x=>x.telemetry.samples[0].criticalAlerts=1,'blocked-stability');
test('collection must follow completed 24-hour window',x=>x.telemetry.collectedAt='2026-10-01T12:00:00Z','blocked-stability');
test('missing physical installed PWA blocks',x=>x.devices.devices.pop(),'blocked-physical');
test('incorrect physical SW version blocks',x=>x.devices.devices[0].serviceWorkerSha256=q,'blocked-physical');
test('missing PWA persistence case blocks',x=>x.devices.devices[2].cases.pop(),'blocked-physical');
test('physical case must include evidence digest',x=>x.devices.devices[1].cases[0].evidenceDigest='bad','blocked-physical');
test('physical observation before deployment invalid',x=>x.devices.devices[1].observedAt='2026-09-30T00:00:00Z','blocked-physical');
test('independent incident review required',x=>x.incidents=null,'blocked-incident-review');
test('open sev1 or sev2 blocks',x=>x.incidents.noOpenSev1OrSev2=false,'blocked-incident-review');
test('rolled-back release cannot certify as live candidate',x=>x.incidents.rollbackExecuted=true,'blocked-incident-review');
test('actual user data loss stops closure',x=>x.incidents.playerDataLoss=true,'blocked-incident-review');
test('unresolved incident stops certification',x=>x.incidents.entries=[{severity:'sev1',status:'open'}],'blocked-incident-review');
test('handoff must have owner signature',x=>x.handoff.ownerSignatureEvidenceDigest='bad','blocked-handoff');
test('handoff requires owner and independent reviewer',x=>x.handoff.independentReviewer=x.cutover.operator,'blocked-handoff');
test('handoff cannot predate final production integrity probe',x=>x.handoff.acceptedAt='2026-10-02T01:01:00Z','blocked-handoff');
test('handoff only after incident review',x=>x.handoff.acceptedAt='2026-10-01T02:00:00Z','blocked-handoff');
const no=Audit.audit();assert.equal(no.status,'blocked-source');
assert.deepEqual(Audit.audit(fixture()).observedSloRatios,{availability:1,persistence:1,recovery:1,runtime:1});
console.log(n+' A13 synthetic post-release documentary adversarial tests passed. No live production or device results represented.');
