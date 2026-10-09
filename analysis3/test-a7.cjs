'use strict';
const assert=require('node:assert/strict'),G=require('./release-gate.js');
let count=0;const test=(name,f)=>{f();count++;console.log('PASS '+name)};
const sha='a'.repeat(40),hash='b'.repeat(64),sw='c'.repeat(64),manifestHash='d'.repeat(64);
const row=({status='passed',source=sha,artifact=hash,extra={}}={})=>({status,sha:source,artifactHash:artifact,issuer:'GitHub Actions/ci',timestamp:'2026-10-09T07:00:00Z',...extra});
const validDevice=id=>row({extra:{device:'Recorded test device',osVersion:'Android 15',
 browserVersion:'Tested 128',testedUrl:'https://candidate.example/gomoku/',tester:'Named tester',
 signature:'Explicit human test attestation',testCases:G.DEVICE_CHECKS[id].map(name=>({
 id:name,status:'passed',observation:'Observed correct behavior on physical hardware'
 }))}});
const base=()=>({
 sourceSha:sha,artifactHash:hash,serviceWorkerHash:sw,manifestHash,targetBranch:'phase/a7-release-qualification',productionUnchanged:true,
 automatedEvidence:Object.fromEntries(G.TESTS.map(id=>[id,row()])),physicalEvidence:{},
 approval:{status:'pending'}
});
test('all automated evidence needs same immutable source commit',()=>{
 const m=base();m.automatedEvidence['a1-forcing-defense']=row({source:'f'.repeat(40)});
 const d=G.qualify(m);assert.equal(d.automationReady,false);assert.equal(d.checks['a1-forcing-defense'],'stale');
});
test('all automated evidence needs same generated index hash',()=>{
 const m=base();m.automatedEvidence['a6-offline-scope']=row({artifact:'0'.repeat(64)});
 const d=G.qualify(m);assert.equal(d.automationReady,false);assert.equal(d.checks['a6-offline-scope'],'wrong-build');
});
test('automated success cannot impersonate real physical Android',()=>{
 const q=G.qualify(base());assert.equal(q.automationReady,true);
 assert.equal(q.physicalReady,false);assert.equal(q.state,'awaiting-physical');
});
test('separate Android Chrome, Samsung and installed PWA are mandatory',()=>{
 assert.deepEqual([...G.PHYSICAL].sort(),['android-chrome','installed-android-pwa','samsung-internet'].sort());
});
test('forged device row without concrete tester evidence is rejected',()=>{
 const m=base();m.physicalEvidence['android-chrome']=row();
 assert.equal(G.qualify(m).physical['android-chrome'],'insufficient-device-evidence');
});
test('generic one-line physical passes cannot bypass required per-device matrices',()=>{
 const m=base();
 for(const p of G.PHYSICAL){
   m.physicalEvidence[p]=validDevice(p);
   m.physicalEvidence[p].testCases=m.physicalEvidence[p].testCases.slice(0,1);
 }
 assert.equal(G.qualify(m).physicalReady,false);
});
test('a physical test reported as passed without an observation is rejected',()=>{
 const m=base();m.physicalEvidence['android-chrome']=validDevice('android-chrome');
 m.physicalEvidence['android-chrome'].testCases[0].observation='';
 assert.equal(G.qualify(m).physical['android-chrome'],'insufficient-device-evidence');
});
test('checklist without explicit test-case execution fails',()=>{
 const m=base();m.physicalEvidence['android-chrome']=row({extra:{device:'Galaxy',osVersion:'Android 15',browserVersion:'122',signature:'tester',testCases:[]}});
 assert.equal(G.qualify(m).physical['android-chrome'],'insufficient-device-evidence');
});
test('successful physical records do not release without owner authorization',()=>{
 const m=base();for(const p of G.PHYSICAL)m.physicalEvidence[p]=validDevice(p);
 const d=G.qualify(m);assert.equal(d.state,'awaiting-owner-approval');assert.equal(d.humanApproval,false);
});
test('matching explicit approval qualifies but never deploys',()=>{
 const m=base();for(const p of G.PHYSICAL)m.physicalEvidence[p]=validDevice(p);
 m.approval={status:'approved',sha,artifactHash:hash,approvedAt:'2026-10-09T10:00:00Z',approvedBy:'Owner'};
 const d=G.qualify(m);assert.equal(d.state,'release-qualified');assert.match(d.limits,/does not create or ship/);
});
test('a malicious approval from another commit cannot qualify',()=>{
 const m=base();for(const p of G.PHYSICAL)m.physicalEvidence[p]=validDevice(p);
 m.approval={status:'approved',sha:'f'.repeat(40),artifactHash:hash,approvedAt:'2026-10-09T10:00:00Z',approvedBy:'Owner'};
 assert.equal(G.qualify(m).humanApproval,false);
});
test('current production not explicitly preserved is blocked',()=>{
 const m=base();m.productionUnchanged=false;
 assert.equal(G.qualify(m).state,'blocked-automated');
});
test('release gate refuses a wrong target branch',()=>{
 const m=base();m.targetBranch='main';
 assert.equal(G.qualify(m).state,'blocked-automated');
});
test('release gates refuse malformed checks and hashes',()=>{
 const m=base();m.artifactHash='not-a-hash';
 assert.equal(G.qualify(m).automationReady,false);
});
test('unattributed check is not a pass',()=>{
 const m=base();m.automatedEvidence['source-integrity'].issuer='';
 assert.equal(G.qualify(m).checks['source-integrity'],'unattributed');
});
test('expired or malformed date fails evidence audit',()=>{
 const m=base();m.automatedEvidence['source-integrity'].timestamp='invalid';
 assert.equal(G.qualify(m).checks['source-integrity'],'invalid');
});
test('all required test IDs are unique and not cosmetic',()=>{
 assert.equal(new Set(G.TESTS).size,G.TESTS.length);
 assert.ok(G.TESTS.includes('a7-threat-benchmark'));assert.ok(G.TESTS.includes('rollback-dry-run'));
});
test('rollback is refused if production works',()=>{
 assert.equal(G.fallbackDecision({productionBroken:false}).action,'hold');
});
test('rollback is refused if prior build hash is absent',()=>{
 assert.equal(G.fallbackDecision({productionBroken:true,currentBuild:hash}).action,'block');
});
test('rollback is refused if prior and current artifacts match',()=>{
 assert.equal(G.fallbackDecision({productionBroken:true,currentBuild:hash,previousBuild:hash,ownerApproved:true}).action,'block');
});
test('rollback is refused without explicit owner approval',()=>{
 assert.equal(G.fallbackDecision({productionBroken:true,currentBuild:hash,previousBuild:sw}).action,'block');
});
test('approved rollback requires a distinct verified build hash',()=>{
 const q=G.fallbackDecision({productionBroken:true,currentBuild:hash,previousBuild:sw,ownerApproved:true});
 assert.equal(q.action,'rollback-to-verified');assert.equal(q.expectedBuildHash,sw);
});
console.log(count+' A7 release qualification and rollback contracts passed');
