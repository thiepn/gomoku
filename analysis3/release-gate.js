/* A7 — a release must be tied to an immutable build and real evidence.
 * No fabricated device test, no upgrade to verified from "unknown",
 * no implicit merge/deploy from a green desktop Chromium run. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&typeof root==='object')root.GomokuReleaseGate7=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const TESTS=Object.freeze([
  'source-integrity','review-core','rules-renju','proof-coverage',
  'a0-evidence','a1-forcing-defense','a2-comparability','a3-workspace',
  'a4-diagnosis','a5-practice','a6-worker-lifecycle','a6-offline-scope',
  'a7-threat-benchmark','desktop-chromium','mobile-emulation',
  'keyboard-accessibility','offline-browser-reload','deterministic-build',
  'security-scope','rollback-dry-run'
 ]);
 const DEVICE_CHECKS=Object.freeze({
   'android-chrome':Object.freeze(['fresh-launch','rules-renju','review-proof','training','offline-reconnect','resume','accessibility']),
   'samsung-internet':Object.freeze(['fresh-launch','rules-renju','review-proof','training','offline-reconnect','resume']),
   'installed-android-pwa':Object.freeze(['install-preview','standalone-launch','offline-launch','saved-data-relaunch','service-worker-update'])
 });
 const PHYSICAL=Object.freeze(Object.keys(DEVICE_CHECKS));
 const HASH=/^[0-9a-f]{64}$/,SHA=/^[0-9a-f]{40}$/;
 const SEP='/';
 function evidenceState(row,{sha,artifactHash}={}){
   if(!row||row.status!=='passed')return 'missing';
   if(!SHA.test(row.sha||'')||row.sha!==sha)return 'stale';
   if(!HASH.test(row.artifactHash||'')||row.artifactHash!==artifactHash)return 'wrong-build';
   if(typeof row.timestamp!=='string'||!Number.isFinite(Date.parse(row.timestamp)))return 'invalid';
   if(!row.issuer||typeof row.issuer!=='string')return 'unattributed';
   return 'passed';
 }
 function qualify(manifest){
   const issues=[],checks={},physical={};
   const sha=manifest?.sourceSha,artifactHash=manifest?.artifactHash;
   const valid=SHA.test(sha||'')&&HASH.test(artifactHash||'')&&HASH.test(manifest?.serviceWorkerHash||'')&&HASH.test(manifest?.manifestHash||'');
   if(!valid)issues.push('Missing immutable candidate SHA or generated asset SHA-256 hashes.');
   if(manifest?.targetBranch!=='phase/a7-release-qualification')
     issues.push('Candidate not restricted to the A7 qualification branch.');
   if(manifest?.productionUnchanged!==true)issues.push('Production freeze not attested.');
   if(manifest?.automatedEvidence&&typeof manifest.automatedEvidence!=='object')issues.push('Malformed automated checks.');
   for(const id of TESTS){
     const row=manifest?.automatedEvidence?.[id];
     const state=evidenceState(row,{sha,artifactHash});
     checks[id]=state;if(state!=='passed')issues.push('Automated check '+id+': '+state);
   }
   for(const id of PHYSICAL){
     const row=manifest?.physicalEvidence?.[id];
     let state=evidenceState(row,{sha,artifactHash});
     if(state==='passed'){
       const checks=Array.isArray(row.testCases)?row.testCases:[];
       const complete=DEVICE_CHECKS[id].every(name=>checks.some(c=>
         c?.id===name&&c?.status==='passed'&&typeof c.observation==='string'&&c.observation.trim().length>=6));
       const attributable=typeof row.device==='string'&&row.device.trim()&&typeof row.osVersion==='string'&&row.osVersion.trim()&&
         typeof row.browserVersion==='string'&&row.browserVersion.trim()&&
         typeof row.testedUrl==='string'&&/^https:\/\//.test(row.testedUrl)&&
         typeof row.tester==='string'&&row.tester.trim()&&
         typeof row.signature==='string'&&row.signature.trim()&&checks.length<=50;
       if(!complete||!attributable)state='insufficient-device-evidence';
     }
     physical[id]=state;
   }
   const automationReady=valid&&manifest?.targetBranch==='phase/a7-release-qualification'&&
      manifest?.productionUnchanged===true&&TESTS.every(id=>checks[id]==='passed');
   const physicalReady=PHYSICAL.every(id=>physical[id]==='passed');
   const approval=manifest?.approval||{};
   const humanApproval=approval.status==='approved'&&approval.sha===sha&&
      approval.artifactHash===artifactHash&&typeof approval.approvedAt==='string'&&
      Number.isFinite(Date.parse(approval.approvedAt))&&!!approval.approvedBy;
   const state=!automationReady?'blocked-automated':
     !physicalReady?'awaiting-physical':!humanApproval?'awaiting-owner-approval':'release-qualified';
   return Object.freeze({state,automationReady,physicalReady,humanApproval,
     checks,physical,blockers:[...issues,
       ...PHYSICAL.filter(id=>physical[id]!=='passed').map(id=>'Physical device '+id+': '+physical[id]),
       ...((automationReady&&physicalReady&&!humanApproval)?['Explicit owner approval missing.']:[])],
     limits:'This contract does not create or ship a release, measure Elo, attest native-device testing automatically, or change the production branch.'});
 }
 function fallbackDecision({currentBuild,previousBuild,productionBroken,ownerApproved}={}){
   if(!productionBroken)return {action:'hold',reason:'No evidence of a production regression.'};
   if(!HASH.test(previousBuild||'')||previousBuild===currentBuild)
     return {action:'block',reason:'A distinct previously verified build hash is required.'};
   if(!ownerApproved)return {action:'block',reason:'Rollback requires explicit owner approval.'};
   return {action:'rollback-to-verified',expectedBuildHash:previousBuild,
     reason:'Restore only the previously verified immutable assets; do not overwrite personal game or training databases.'};
 }
 return Object.freeze({VERSION:'3.0.0-a7',TESTS,PHYSICAL,DEVICE_CHECKS,qualify,evidenceState,fallbackDecision});
});
