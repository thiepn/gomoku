/* A26 adversarial source original and pending witness-only acceptance checks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),
 path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const A26=require('./a26-witness-intake.cjs'),A25=require('./a25-handoff.cjs');
const PIN=require('./a10-source-lock.json');
const ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'gomoku-a26-'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const now=new Date('2026-10-11T01:00:00.000Z');
const observedAt='2026-10-10T18:00:00.000Z';
const bmedia=Buffer.from('SYNTHETIC A26 original media NOT real hardware');
const brights=Buffer.from('SYNTHETIC A26 original unapproved rights');
const bwitness=Buffer.from('SYNTHETIC A26 signed-looking witness file NOT human proof');
let cases=0;
function t(name,fn){fn();console.log('PASS A26 '+name);cases++;}
function write(p,bytes){const full=path.join(ROOT,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,bytes);return full;}
function fixture(){
 write('media/android-chrome/fresh-launch.bin',bmedia);
 write('rights/android-chrome/fresh-launch.bin',brights);
 write('witness/android-chrome/fresh-launch.bin',bwitness);
 const fieldManifest={format:'GomokuA24FieldOriginalIntake',version:24,sourceSha:PIN.sourceSha,
  a23Head:'d36610bc49aa0cee03f3a649108fda98e99094ee',
  humanOwnerApproval:'NOT_OBTAINED',releaseState:'NO_GO',physicalCasesAccepted:0,
  productionDataTouched:false,cases:[{platform:'android-chrome',caseId:'fresh-launch',
   status:'OBSERVED_PENDING_INDEPENDENT_REVIEW',
   originalFile:'media/android-chrome/fresh-launch.bin',sha256:sha(bmedia),
   ownerRightsIntakeSha256:sha(brights),
   hardwareModel:'SYNTHETIC DEVICE',androidVersion:'FAKE VERSION',
   browserVersion:'FAKE CHROME',operatorId:'SYNTHETIC OPERATOR',observedAt,
   observation:'Synthetic fixture with bytes on local disk, not a real device.'}],accessibility:[]};
 const a25Handoff=A25.review({fieldManifest,fieldRoot:ROOT,rightsRoot:ROOT,now});
 const witnessManifest={format:'GomokuA26WitnessCandidate',version:26,
  sourceHead:'10670c85fbd18077069ad69dc8a8079e0214127f',
  a25HandoffDigest:a25Handoff.handoffDigest,
  state:'PENDING_INDEPENDENT_AUTHENTICATION',ownerApproval:'NOT_OBTAINED',
  releaseState:'NO_GO',humanVerifiedCount:0,entries:[{
   group:'field',id:'android-chrome:fresh-launch',mediaSha256:sha(bmedia),
   rightsSha256:sha(brights),witnessOriginalSha256:sha(bwitness),
   witnessFile:'witness/android-chrome/fresh-launch.bin',
   claimedWitnessAlias:'NOT REAL WITNESS',observation:'This is a synthetic case, never signed or observed on hardware.',
   observedAt,state:'PENDING_INDEPENDENT_AUTHENTICATION'}]};
 return{a25Handoff,fieldManifest,fieldRoot:ROOT,rightsRoot:ROOT,
  witnessManifest,witnessRoot:ROOT,now};
}
function passes(){return A26.review(fixture());}
try{
 t('base A25 byte requalification never promotes claim to acceptance',()=>{
  const x=passes();assert.equal(x.decision,'NO_GO');assert.equal(x.pendingWitnessOriginalCount,1);
  assert.equal(x.actualPhysicalAccepted,0);assert.equal(x.independentHumanIdentityVerified,false);
  assert.equal(x.consentAndSourceRightsApproved,false);assert.equal(x.canMerge,false);
  assert.equal(x.canDeploy,false);assert.equal(x.canCloseRelease,false);
  assert.equal(x.candidateRecords[0].originalWitnessSha256,sha(bwitness));
 });
 t('mismatched candidate source head is rejected',()=>{
  const x=fixture();x.witnessManifest.sourceHead='0'.repeat(40);
  assert.throws(()=>A26.review(x),/invalid candidate/);
 });
 t('A25 detached forged evidence digest fails independent originals requalification',()=>{
  const x=fixture();x.a25Handoff.evidence.field[0].sha256='b'.repeat(64);
  x.a25Handoff.handoffDigest=sha(Buffer.from(JSON.stringify(x.a25Handoff.evidence)));
  assert.throws(()=>A26.review(x),/exact original-byte/);
 });
 t('A25 prior custody conflict always blocks instead of choosing a winner',()=>{
  const x=fixture();x.a25Handoff.manualResolutionRequired=true;
  assert.throws(()=>A26.review(x),/custody conflicts/);
 });
 t('A25 alleged owner signoff never accepted',()=>{
  const x=fixture();x.a25Handoff.ownerApproved=true;
  assert.throws(()=>A26.review(x),/exact original-byte/);
 });
 t('A26 forged human acceptance flag rejected',()=>{
  const x=fixture();x.witnessManifest.humanVerifiedCount=1;
  assert.throws(()=>A26.review(x),/invalid candidate/);
 });
 t('A26 unexpected certification capability flag rejected',()=>{
  const x=fixture();x.witnessManifest.canDeploy=true;
  assert.throws(()=>A26.review(x),/invalid candidate/);
 });
 t('witness original SHA tampering rejected',()=>{
  const x=fixture();x.witnessManifest.entries[0].witnessOriginalSha256='c'.repeat(64);
  assert.throws(()=>A26.review(x),/witness original file byte hash mismatch/);
 });
 t('rights source SHA mismatch rejected',()=>{
  const x=fixture();x.witnessManifest.entries[0].rightsSha256='d'.repeat(64);
  assert.throws(()=>A26.review(x),/media\/rights mismatch/);
 });
 t('media original source mutation cannot be covered by witness hash',()=>{
  const x=fixture();write('media/android-chrome/fresh-launch.bin','FAKE DIFFERENT MEDIA');
  assert.throws(()=>A26.review(x),/SHA mismatch/);
 });
 t('path traversal and paths outside fixed original witness root rejected',()=>{
  const x=fixture();x.witnessManifest.entries[0].witnessFile='../outside.bin';
  assert.throws(()=>A26.review(x),/canonical private-custody/);
 });
 t('missing external witness file fails closed',()=>{
  const x=fixture();fs.unlinkSync(path.join(ROOT,'witness/android-chrome/fresh-launch.bin'));
  assert.throws(()=>A26.review(x),/missing, unsafe/);
 });
 t('refuses self-reported dates in the future',()=>{
  const x=fixture();x.witnessManifest.entries[0].observedAt='2029-10-10T18:00:00.000Z';
  assert.throws(()=>A26.review(x),/future self-reported/);
 });
 t('rejects no candidate records',()=>{
  const x=fixture();x.witnessManifest.entries=[];
  assert.throws(()=>A26.review(x),/invalid candidate/);
 });
 t('refuses duplicate original witness identity',()=>{
  const x=fixture();x.witnessManifest.entries.push({...x.witnessManifest.entries[0]});
  assert.throws(()=>A26.review(x),/unknown\/duplicate/);
 });
 t('CLI writes protected, immutable, private and NO_GO result',()=>{
  const x=fixture();
  const a25=write('a25.json',JSON.stringify(x.a25Handoff)),
   field=write('field.json',JSON.stringify(x.fieldManifest)),
   manifest=write('witness.json',JSON.stringify(x.witnessManifest));
  const dest=path.join(ROOT,'a26-result.json');
  const cmd=[path.join(__dirname,'a26-witness-intake.cjs'),'--a25',a25,
   '--field-manifest',field,'--field-root',ROOT,'--rights-root',ROOT,
   '--witness-manifest',manifest,'--witness-root',ROOT,'--out',dest];
  let p=cp.spawnSync(process.execPath,cmd,{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const j=JSON.parse(fs.readFileSync(dest,'utf8'));
  assert.equal(j.decision,'NO_GO');assert.equal(j.canMerge,false);
  assert.equal(fs.statSync(dest).mode&0o077,0);
  p=cp.spawnSync(process.execPath,cmd,{encoding:'utf8'});
  assert.notEqual(p.status,0);assert.match(p.stderr,/EEXIST/);
  assert(!fs.readFileSync(dest,'utf8').includes('SYNTHETIC A26 original'));
  assert(!fs.readFileSync(dest,'utf8').includes('This is a synthetic case'));
 });
 t('CLI rejects unknown optional authority flag',()=>{
  const p=cp.spawnSync(process.execPath,[path.join(__dirname,'a26-witness-intake.cjs'),
   '--approve','yes'],{encoding:'utf8'});
  assert.notEqual(p.status,0);assert.match(p.stderr,/unknown or duplicate flag/);
 });
}finally{fs.rmSync(ROOT,{recursive:true,force:true})}
console.log(cases+' A26 source + adversarial independent human-witness tests passed. NO real human/device acceptance.');
