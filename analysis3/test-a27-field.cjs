/* A27 source-only tests: synthetic receipts never count as real Android or human consent. */
'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
 crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const P=require('./a27-field-intake.cjs'),A9=require('./a10-source-lock.json');
const SHA=b=>crypto.createHash('sha256').update(b).digest('hex');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gomoku-a27-'));
let n=0;
const DEVICE='android-chrome:fresh-launch';
const media=Buffer.from('SYNTHETIC A27 MEDIA NOT A PHYSICAL PHONE'),
 rights=Buffer.from('SYNTHETIC A27 RIGHTS NOT HUMAN CONSENT'),
 witness=Buffer.from('SYNTHETIC A27 WITNESS NOT REAL SIGNATURE');
const now=new Date('2026-10-11T10:00:00.000Z');
function put(rel,contents){const file=path.join(tmp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);return file;}
function test(name,fn){fn();n++;console.log('PASS A27 '+name);}
function manifest(observations=[]){return {
 format:'GomokuA27PhysicalObservationDraft',version:27,
 a26QualifiedHead:'407bfb88430539932ab6bf07df1b33ae7b86829c',
 originalA9SourceSha:A9.sourceSha,releaseState:'NO_GO',
 humanOwnerApproval:'NOT_OBTAINED',observations};}
function obs(status='FAIL',extra={}){return{
 id:DEVICE,reportedStatus:status,testedOrigin:'https://isolated-synthetic-preview.vercel.app/',
 deviceModel:'SYNTHETIC PIXEL',osVersion:'FAKE ANDROID 15',
 browserVersion:'NOT REAL CHROME',operatorAlias:'SYNTHETIC OPERATOR',
 observedAt:'2026-10-10T18:00:00.000Z',
 observation:'Synthetic offline CI fixture, never performed by a person on an actual device.',
 originalMediaSha256:null,originalRightsSha256:null,originalWitnessSha256:null,...extra};}
function receipt(){return{
 format:'GomokuA26UnverifiedOriginalWitnessHandoff',version:26,
 sourceHead:'407bfb88430539932ab6bf07df1b33ae7b86829c',
 a25HandoffDigest:'a'.repeat(64),originalA9SourceSha:A9.sourceSha,
 sourceFileIntegrityOnly:true,originalMediaIncluded:false,personalObservationsExported:false,
 candidateRecords:[{id:DEVICE,sourceMediaSha256:SHA(media),sourceRightsSha256:SHA(rights),
  originalWitnessSha256:SHA(witness),originalWitnessBytes:witness.length,
  claimedWitnessAliasSha256:SHA(Buffer.from('FAKE')),status:'BYTES_MATCHED_PENDING_EXTERNAL_IDENTITY_RIGHTS_AND_OBSERVATION_REVIEW'}],
 pendingWitnessOriginalCount:1,missingPhysicalCases:[],missingAccessibility:[],
 actualPhysicalAccepted:0,actualAccessibilityAccepted:0,genuineHostedOriginAuthenticated:false,
 independentHumanIdentityVerified:false,consentAndSourceRightsApproved:false,
 realSignerRoots:0,globalReplayAccepted:false,realServiceWorkerUpdate:false,
 realPlayerStateRecovery:false,ownerApproved:false,realCutoverPerformed:false,
 realA13Hours:0,canMerge:false,canTag:false,canDeploy:false,canModifyProductionData:false,
 canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
 releaseGates:[],decision:'NO_GO',
 status:'PENDING_INDEPENDENT_HUMAN_AND_ORIGINAL_SOURCE_AUTHENTICATION'};
}
function withOriginals(){
 put('media/android-chrome/fresh-launch.bin',media);
 put('rights/android-chrome/fresh-launch.bin',rights);
 put('witness/android-chrome/fresh-launch.bin',witness);
 const record=obs('PASS',{originalMediaSha256:SHA(media),
  originalRightsSha256:SHA(rights),originalWitnessSha256:SHA(witness)});
 return {manifest:manifest([record]),receipt:receipt(),mediaRoot:tmp,rightsRoot:tmp,witnessRoot:tmp,now};
}
try{
 test('exact 18 device plus seven accessibility IDs and immutable ordering',()=>{
  assert.equal(P.CASES.length,25);
  assert.equal(P.CASES[0],DEVICE);assert.equal(P.CASES.at(-1),'accessibility:offline-state-persistence');
  assert.equal(new Set(P.CASES).size,25);
 });
 test('nothing done: all 25 NOT_TESTED and zero human-approved',()=>{
  const r=P.evaluate({manifest:manifest(),now});
  assert.equal(r.notTested,25);assert.equal(r.reportedPass,0);assert.equal(r.reportedFail,0);
  assert.equal(r.physicalHumanAccepted,0);assert.equal(r.accessibilityHumanAccepted,0);
  assert.equal(r.decision,'NO_GO');assert.equal(r.canDeploy,false);assert.equal(r.caseStates.length,25);
 });
 test('operator FAIL without originals is triage, never certified or counted as pass',()=>{
  const r=P.evaluate({manifest:manifest([obs()]),now});
  assert.equal(r.reportedFail,1);assert.equal(r.notTested,24);assert.equal(r.reportedPass,0);
  assert.equal(r.openReproductionIssues.length,2);
  assert.equal(r.observedResults[0].evidenceStatus,'MISSING_ORIGINALS_FAIL_REQUIRES_TRIAGE');
  assert.equal(r.physicalHumanAccepted,0);
 });
 test('PASS without evidence is rejected',()=>{
  assert.throws(()=>P.evaluate({manifest:manifest([obs('PASS')]),now}),/cannot omit/);
 });
 test('rehashed three original synthetic file sources remain UNAUTHENTICATED',()=>{
  const r=P.evaluate(withOriginals());
  assert.equal(r.reportedPass,1);
  assert.equal(r.caseStates[0].status,'PASS');
  assert.match(r.observedResults[0].evidenceStatus,/NOT_HUMAN_AUTHENTICATED/);
  assert.equal(r.physicalHumanAccepted,0);assert.equal(r.canCertifyPhysical,false);
 });
 test('different original media bytes rejected despite signed-looking report',()=>{
  const opts=withOriginals();put('media/android-chrome/fresh-launch.bin','MUTATED MEDIA');
  assert.throws(()=>P.evaluate(opts),/original byte conflict/);
 });
 test('forged receipt human approval and certification refused',()=>{
  const opts=withOriginals();opts.receipt.ownerApproved=true;
  assert.throws(()=>P.evaluate(opts),/untrusted A26/);
 });
 test('mismatching A26 SHA receipt refuses substituted original claim',()=>{
  const opts=withOriginals();opts.receipt.candidateRecords[0].sourceRightsSha256='f'.repeat(64);
  assert.throws(()=>P.evaluate(opts),/A26 matched-original/);
 });
 test('pass with incomplete source roots refused',()=>{
  const opts=withOriginals();delete opts.witnessRoot;
  assert.throws(()=>P.evaluate(opts),/original roots/);
 });
 test('duplicate physical case receipt is denied',()=>{
  const m=manifest([obs(),obs()]);
  assert.throws(()=>P.evaluate({manifest:m,now}),/duplicate/);
 });
 test('future observation time refused',()=>{
  const x=obs('FAIL',{observedAt:'2031-10-11T10:00:00.000Z'});
  assert.throws(()=>P.evaluate({manifest:manifest([x]),now}),/future/);
 });
 test('owner approval cannot be smuggled into draft',()=>{
  const m=manifest();m.humanOwnerApproval='APPROVED';
  assert.throws(()=>P.evaluate({manifest:m,now}),/authority/);
 });
 test('unknown approval capability fields blocked',()=>{
  const m=manifest();m.canDeploy=true;
  assert.throws(()=>P.evaluate({manifest:m,now}),/authority/);
 });
 test('protected thiepn.dev production origin rejected',()=>{
  const m=manifest([obs('FAIL',{testedOrigin:'https://gomoku.thiepn.dev/'})]);
  assert.throws(()=>P.evaluate({manifest:m,now}),/production/);
 });
 test('user info and embedded credentials refused in preview URL',()=>{
  const m=manifest([obs('FAIL',{testedOrigin:'https://user:pass@host.vercel.app/'})]);
  assert.throws(()=>P.evaluate({manifest:m,now}),/preview/);
 });
 test('HTTP and localhost refused even for FAIL',()=>{
  assert.throws(()=>P.preview('http://localhost:3000/'),/HTTPS/);
 });
 test('unrecognized PASS/FAIL/NOT_TESTED notation blocked for observation',()=>{
  assert.throws(()=>P.evaluate({manifest:manifest([obs('not_tested')]),now}),/unrecognized/);
 });
 test('traversal through symlinked originals rejected',()=>{
  const opts=withOriginals();
  const target=path.join(tmp,'witness/android-chrome/fresh-launch.bin');
  fs.unlinkSync(target);fs.symlinkSync(path.join(tmp,'media/android-chrome/fresh-launch.bin'),target);
  assert.throws(()=>P.evaluate(opts),/unsafe\/missing original/);
 });
 test('CLI initial empty NOT_TESTED report is private, immutable and NO_GO',()=>{
  const f=put('observations.json',JSON.stringify(manifest()));
  const output=path.join(tmp,'result.json');
  const call=[path.join(__dirname,'a27-field-intake.cjs'),'--observations',f,'--out',output];
  const p=cp.spawnSync(process.execPath,call,{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const r=JSON.parse(fs.readFileSync(output,'utf8'));
  assert.equal(r.reportedPass,0);assert.equal(r.notTested,25);assert.equal(r.decision,'NO_GO');
  assert.equal(fs.statSync(output).mode&0o077,0);
  const again=cp.spawnSync(process.execPath,call,{encoding:'utf8'});
  assert.notEqual(again.status,0);assert.match(again.stderr,/EEXIST/);
 });
 test('CLI refuses unsupported auto-approval and partial root groups',()=>{
  const x=put('none.json',JSON.stringify(manifest()));
  const output=path.join(tmp,'another.json'),bin=path.join(__dirname,'a27-field-intake.cjs');
  let p=cp.spawnSync(process.execPath,[bin,'--observations',x,'--out',output,'--approve','yes'],{encoding:'utf8'});
  assert.notEqual(p.status,0);assert.match(p.stderr,/unknown/);
  p=cp.spawnSync(process.execPath,[bin,'--observations',x,'--out',output,'--media-root',tmp],{encoding:'utf8'});
  assert.notEqual(p.status,0);assert.match(p.stderr,/together/);
 });
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log(n+' A27 adversarial tests passed with synthetic fixtures only. NO real device or approval evidence.');
