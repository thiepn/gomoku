/* A12 documentary-only cutover preflight; no deployment or mutation authority. */
'use strict';
const fs=require('node:fs'),LOCK=require('./a10-source-lock.json'),A9=require('./rc9-core.cjs');
const H40=/^[0-9a-f]{40}$/i,H64=/^[0-9a-f]{64}$/i;
const checks=Object.freeze(['p15','governance','p13','ranked','lifecycle','history','profiles','integrity','portable-preview','p19-supply-chain','p20-slo','p21-capacity','p23-security']);
const str=x=>typeof x==='string'&&x.trim().length>0;
const date=x=>str(x)&&Number.isFinite(Date.parse(x));
const later=(a,b)=>date(a)&&date(b)&&Date.parse(a)>=Date.parse(b);
function origin(x){try{const u=new URL(x);return u.protocol==='https:'&&u.origin+'/'===x&&u.hostname.includes('.')&&!u.hostname.endsWith('.vercel.app')&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.port&&!u.username&&!u.password;}catch{return false}}
function result(status,reason){return {format:'GomokuAnalysis3A12Preflight',sourceSha:LOCK.sourceSha,status,reason,
 canMerge:false,canTag:false,canDeployProduction:false,canModifyProductionData:false,
 notice:'Documentary review only. Originals require independent live authentication. Never a release authorization.'};}
function assess({a11,review,ci,authorization,baseline,monitor}={}){
 if(a11?.format!=='GomokuAnalysis3A11Admission'||a11?.status!=='ready-for-independent-release-review'||
   a11.sourceSha!==LOCK.sourceSha||a11.offlineZipSha256!==LOCK.offlineZipSha256||
   a11.physicalCases?.required!==18||a11.physicalCases?.passed!==18||
   a11.stages?.source!=='locked-a9-automation'||a11.stages?.preview!=='eight-assets-match-receipt-documentary'||
   a11.stages?.physical!=='documented-18-of-18-not-independently-retested'||
   a11.stages?.controlledUpdate!=='documented-not-independently-retested'||
   a11.stages?.rollback!=='documented-not-independently-retested'||
   a11.stages?.owner!=='documented-approved-not-production-authorized'||
   !Array.isArray(a11.issues)||a11.issues.length||
   a11.canMerge!==false||a11.canTag!==false||a11.canDeployProduction!==false)
   return result('blocked-a11','A11 original source, physical, HTTPS, SW update, restore and owner documentary gates not complete.');
 if(review?.status!=='independently-verified'||review.sourceSha!==LOCK.sourceSha||
   !H40.test(review.a11HeadSha||'')||!str(review.reviewer)||!date(review.reviewedAt)||
   review.physicalCases!==18||!H64.test(review.hostProbeDigest||'')||
   !H64.test(review.swUpdateDigest||'')||!H64.test(review.restoreDigest||'')||
   !H64.test(review.originalsDigest||'')||
   !/^https:\/\/[^/]+\.vercel\.app\/$/.test(review.previewOrigin||''))
   return result('blocked-review','Independently checked real originals, hosted HTTPS and 18 physical cases are mandatory.');
 if(ci?.repository!=='thiepn/gomoku'||ci.sourceSha!==LOCK.sourceSha||
   ci.a11HeadSha!==review.a11HeadSha||!H40.test(ci.a10HeadSha||'')||
   ci.a10Passed!==true||ci.a11Passed!==true||
   !Number.isSafeInteger(ci.a10RunId)||ci.a10RunId<=0||
   !Number.isSafeInteger(ci.a11RunId)||ci.a11RunId<=0||
   !date(ci.observedAt)||!H64.test(ci.evidenceDigest||''))
   return result('blocked-ci','Exact-head A10 and A11 GitHub check receipts missing.');
 for(const name of checks){const x=ci.checks?.[name];if(x?.conclusion!=='success'||x.sha!==ci.a11HeadSha||!Number.isSafeInteger(x.runId)||x.runId<=0)
   return result('blocked-ci','Missing exact-head P16 mandatory check: '+name);}
 if(authorization?.status!=='explicit-production-approved'||authorization.sourceSha!==LOCK.sourceSha||
   authorization.a10HeadSha!==ci.a10HeadSha||authorization.a11HeadSha!==ci.a11HeadSha||
   !origin(authorization.productionOrigin)||!str(authorization.owner)||!str(authorization.operator)||
   !str(authorization.changeTicket)||!str(authorization.maintenanceWindow)||
   !H64.test(authorization.approvalDigest||'')||!later(authorization.approvedAt,review.reviewedAt)||
   authorization.rollbackZipSha256!==LOCK.offlineZipSha256||authorization.dataMigration!=='none')
   return result('blocked-production-authorization','Separate scoped owner approval for exact production origin, source, rollback and zero migration absent.');
 if(!baseline||!H40.test(baseline.mainSha||'')||!later(baseline.capturedAt,authorization.approvedAt)||
   !str(baseline.backupLocation)||!H64.test(baseline.backupDigest||'')||
   baseline.restoreTested!==true||baseline.productionUnaffected!==true||
   !Array.isArray(baseline.assets)||baseline.assets.length!==A9.ASSETS.length)
   return result('blocked-recovery','Fresh live baseline, original eight hashes and independently tested restore absent.');
 const unique=new Set();
 for(const a of baseline.assets){if(!A9.ASSETS.includes(a?.path)||unique.has(a.path)||!H64.test(a.sha256||''))
   return result('blocked-recovery','Unexpected, duplicated or invalid current-production asset.');unique.add(a.path);}
 if(A9.ASSETS.some(x=>!unique.has(x)))return result('blocked-recovery','Incomplete production baseline.');
 if(!monitor||['onCall','escalation','rollbackTrigger','rollbackOwner','pwaOfflineCheck',
   'playerDataCheck','liveAssetCheck','restoreProcedure'].some(k=>!str(monitor[k]))||
   !H64.test(monitor.planDigest||''))
   return result('blocked-monitoring','Live owner, incident triggers, SHA probes, PWA/data safety and rollback plan absent.');
 return result('manual-review-only','Documents appear complete; independently verify originals again before a separate manual production authorization.');
}
function read(p){return p?JSON.parse(fs.readFileSync(p,'utf8')):null}
if(require.main===module){const p=process.argv.slice(2);
 const r=assess({a11:read(p[0]),review:read(p[1]),ci:read(p[2]),authorization:read(p[3]),baseline:read(p[4]),monitor:read(p[5])});
 console.log(JSON.stringify(r,null,2));if(r.status!=='manual-review-only')process.exitCode=2;}
module.exports={assess,origin,checks};
