'use strict';
const assert=require('node:assert/strict'),C=require('./rc9-core.cjs');
const sha='a'.repeat(40),hash='b'.repeat(64),now='2026-10-09T10:00:00Z';
const sample=()=>({format:'GomokuAnalysis3Candidate',version:9,sourceSha:sha,sourceBranch:C.BRANCH,originMainFrozen:true,
 workflowRunId:'123456',assets:Object.fromEntries(C.ASSETS.map(p=>[p,hash])),
 stages:Object.fromEntries(C.STAGES.map(p=>[p,{status:'passed',sourceSha:sha,indexSha256:hash,workflowRunId:'123456',
 completedAt:now,issuer:'GitHub Actions'}]))});
const device=id=>({status:'passed',sha,artifactHash:hash,device:'Physical Android model',osVersion:'Android 15',
 browserVersion:'130',testedUrl:'https://preview.example/gomoku/',tester:'Person',
 signature:'Signed by tester',issuer:'Physical test by Person',timestamp:now,
 testCases:C.DEVICE_CHECKS[id].map(q=>({id:q,status:'passed',observation:'Observed this exact feature working on the stated physical device.'}))});
const worksheet=()=>({sourceSha:sha,indexSha256:hash,serviceWorkerSha256:hash,manifestSha256:hash,
 candidatePreviewUrl:'https://preview.example/gomoku/',
 physicalEvidence:Object.fromEntries(C.PHYSICAL.map(k=>[k,device(k)])),
 ownerApproval:{status:'approved',sha,artifactHash:hash,approvedBy:'Owner',approvedAt:now}});
let tests=0;function test(title,fn){fn();console.log('PASS '+title);tests++;}
test('canonical A9 receipt passes automated stage contract',()=>assert.equal(C.automated(sample()).ok,true));
test('all required stage names are unique',()=>assert.equal(new Set(C.STAGES).size,C.STAGES.length));
test('missing stage cannot claim CI qualification',()=>{let c=sample();delete c.stages.browser;assert.equal(C.automated(c).ok,false)});
test('stale stage SHA is rejected',()=>{let c=sample();c.stages.tactical.sourceSha='f'.repeat(40);assert.equal(C.automated(c).ok,false)});
test('different index hash invalidates prior stage',()=>{let c=sample();c.stages.package.indexSha256='e'.repeat(64);assert.equal(C.automated(c).ok,false)});
test('stage from another workflow run is rejected',()=>{let c=sample();c.stages.offline.workflowRunId='unknown';assert.equal(C.automated(c).ok,false)});
test('missing artifact sha256 invalidates candidate',()=>{let c=sample();delete c.assets['icons/icon-512.png'];assert.equal(C.automated(c).ok,false)});
test('forged production changed marker invalidates candidate',()=>{let c=sample();c.originMainFrozen=false;assert.equal(C.automated(c).ok,false)});
test('non-A9 branch cannot qualify',()=>{let c=sample();c.sourceBranch='main';assert.equal(C.automated(c).ok,false)});
test('blank physical evidence remains blocked',()=>{const q=C.qualify(sample(),null);assert.equal(q.status,'awaiting-physical');assert.equal(q.canDeploy,false)});
test('device worksheet with complete matching data is accepted',()=>assert.equal(C.physical(sample(),worksheet()).ok,true));
test('missing Samsung Internet cannot be called tested',()=>{const w=worksheet();delete w.physicalEvidence['samsung-internet'];assert.equal(C.physical(sample(),w).ok,false)});
test('desktop emulation with missing device metadata is refused',()=>{const w=worksheet();w.physicalEvidence['android-chrome'].device='';assert.equal(C.physical(sample(),w).ok,false)});
test('empty observation fails closed',()=>{const w=worksheet();w.physicalEvidence['installed-android-pwa'].testCases[0].observation='';assert.equal(C.physical(sample(),w).ok,false)});
test('duplicate case cannot substitute for required independent test',()=>{const w=worksheet();const t=w.physicalEvidence['android-chrome'].testCases;t[1].id=t[0].id;assert.equal(C.physical(sample(),w).ok,false)});
test('extra unqualified physical case is refused',()=>{const w=worksheet();w.physicalEvidence['android-chrome'].testCases.push({id:'extra',status:'passed',observation:'something'});assert.equal(C.physical(sample(),w).ok,false)});
test('device tested URL must exactly match preview',()=>{const w=worksheet();w.physicalEvidence['samsung-internet'].testedUrl='https://production.example/';assert.equal(C.physical(sample(),w).ok,false)});
test('dev preview without HTTPS is refused',()=>{const w=worksheet();w.candidatePreviewUrl='http://localhost';assert.equal(C.physical(sample(),w).ok,false)});
test('dev worksheet source SHA mismatch is rejected',()=>{const w=worksheet();w.sourceSha='c'.repeat(40);assert.equal(C.physical(sample(),w).ok,false)});
test('SW hash mismatch disqualifies physical results',()=>{const w=worksheet();w.serviceWorkerSha256='d'.repeat(64);assert.equal(C.physical(sample(),w).ok,false)});
test('missing owner approval blocks even complete device tests',()=>{const w=worksheet();w.ownerApproval.status='pending';assert.equal(C.qualify(sample(),w).status,'awaiting-owner')});
test('approval for another commit is not accepted',()=>{const w=worksheet();w.ownerApproval.sha='d'.repeat(40);assert.equal(C.qualify(sample(),w).status,'awaiting-owner')});
test('matching approval can qualify but never deploy automatically',()=>{const q=C.qualify(sample(),worksheet());assert.equal(q.status,'release-qualified');assert.equal(q.canDeploy,false)});
test('missing source SHA is refused by source inspector',()=>assert.equal(C.inspectSource({branch:C.BRANCH}).ok,false));
test('cache version mismatch is refused by source inspector',()=>{
 const r=C.inspectSource({sourceSha:sha,branch:C.BRANCH,cacheVersion:'gomoku-a9',
 sw:"const CACHE_NAME = 'gomoku-other';",assetPaths:C.ASSETS});assert.ok(r.issues.some(x=>x.includes('cache name')));
});
test('unsupported PWA scope cannot be accepted',()=>{
 const r=C.inspectSource({sourceSha:sha,branch:C.BRANCH,cacheVersion:'gomoku-ok',sw:"const CACHE_NAME = 'gomoku-ok';",
 manifest:JSON.stringify({id:'/other/',start_url:'./',scope:'./',display:'standalone'}),assetPaths:C.ASSETS});
 assert.ok(r.issues.some(x=>x.includes('PWA id')));
});
console.log(tests+' A9 immutable candidate and fail-closed physical gate contracts passed');
