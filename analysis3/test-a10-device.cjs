'use strict';
const assert=require('node:assert/strict'),A=require('./a10-device-assessment.cjs'),C=require('./rc9-core.cjs');
const sha='fca45816ed7d3a95bae550b9aa644e29053875f6',h='b'.repeat(64),now='2026-10-09T13:00:00Z';
const url='https://gomoku-a10-preview-test.vercel.app/';
const c=()=>({format:'GomokuAnalysis3Candidate',version:9,sourceSha:sha,sourceBranch:C.BRANCH,originMainFrozen:true,
 workflowRunId:'37922288752',assets:Object.fromEntries(C.ASSETS.map(s=>[s,h])),
 stages:Object.fromEntries(C.STAGES.map(s=>[s,{status:'passed',sourceSha:sha,indexSha256:h,workflowRunId:'37922288752',completedAt:now,issuer:'GitHub Actions'}]))});
const device=id=>({status:'passed',sha,artifactHash:h,device:'Real Android device',osVersion:'15',browserVersion:'130',
 testedUrl:url,tester:'Explicitly named physical tester',signature:'Physical tester signature',issuer:'Actual person',timestamp:now,
 testCases:C.DEVICE_CHECKS[id].map(id=>({id,status:'passed',observation:'Observed required behavior directly on the specified real Android device'}))});
const w=()=>({sourceSha:sha,indexSha256:h,serviceWorkerSha256:h,manifestSha256:h,
 candidatePreviewUrl:url,physicalEvidence:Object.fromEntries(C.PHYSICAL.map(id=>[id,device(id)])),
 ownerApproval:{status:'not_requested'}});
const live=()=>({url,sourceSha:sha,verifiedAssets:C.ASSETS.map(path=>({path,sha256:h}))});
let n=0;function test(label,fn){fn();n++;console.log('PASS '+label)}
test('no live HTTPS proof blocks any promotion',()=>{const q=A.evaluate(c(),w(),null);assert.equal(q.status,'blocked-preview');assert.equal(q.canDeployProduction,false)});
test('complete live hashes can be checked without inventing physical device results',()=>{
 const x=w();x.physicalEvidence['samsung-internet'].status='pending_manual';
 const q=A.evaluate(c(),x,live());assert.equal(q.status,'awaiting-physical')});
test('wrong live origin blocks evidence',()=>{
 const x=live();x.url='https://other-preview.vercel.app/';assert.equal(A.evaluate(c(),w(),x).status,'blocked-preview')});
test('live index mutation blocks preview',()=>{
 const x=live();x.verifiedAssets[0].sha256='f'.repeat(64);assert.equal(A.evaluate(c(),w(),x).status,'blocked-preview')});
test('complete device tests still need matching owner permission',()=>{assert.equal(A.evaluate(c(),w(),live()).status,'awaiting-owner')});
test('full owner+physical signoff does not issue any production release',()=>{
 const worksheet=w();worksheet.ownerApproval={status:'approved',sha,artifactHash:h,approvedBy:'Owner',approvedAt:now};
 const q=A.evaluate(c(),worksheet,live());assert.equal(q.status,'ready-for-separate-release-authorization');assert.equal(q.canMerge,false);assert.equal(q.canDeployProduction,false)});
test('stale A9 CI source evidence cannot qualify via physical observations',()=>{
 const receipt=c();receipt.stages.offline.sourceSha='c'.repeat(40);assert.equal(A.evaluate(receipt,w(),live()).status,'blocked-automation')});
test('one physically untested PWA update prevents approval',()=>{
 const worksheet=w();worksheet.physicalEvidence['installed-android-pwa'].testCases[4].status='not_tested';
 worksheet.ownerApproval={status:'approved',sha,artifactHash:h,approvedBy:'Owner',approvedAt:now};
 assert.equal(A.evaluate(c(),worksheet,live()).status,'awaiting-physical')});
console.log(n+' A10 device-evidence and production no-deployment contracts passed');
