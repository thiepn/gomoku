/* A25 independent offline operator-original handoff, genuine A9 CI bytes + synthetic operator objects. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const H=require('./a25-handoff.cjs'),F=require('./a24-field-intake.cjs'),A=require('./a24-offline-intake.cjs');
const C=require('./a24-capture-template.cjs'),PIN=require('./a10-source-lock.json');
const BASE=path.resolve(__dirname,'../analysis25-test-output/preview-static');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'a25-field-'));
const NOW=new Date('2026-10-10T20:00:00Z'),HEAD='d36610bc49aa0cee03f3a649108fda98e99094ee';
let n=0;function t(name,fn){fn();n++;console.log('PASS A25 '+name)}
function file(relative,data){const p=path.join(TMP,relative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);return p}
function field(){
 const a=Buffer.from('SYNTHETIC original physical-media content A25 only');
 file('media/android-chrome/fresh-launch.bin',a);
 const b=Buffer.from('SYNTHETIC real browser does not equal assisted hardware');
 file('assistive/screen-reader.bin',b);
 file('rights/android-chrome/fresh-launch.bin',Buffer.from('SYNTHETIC rights document for first device case'));
 file('rights/accessibility/screen-reader.bin',Buffer.from('SYNTHETIC independent accessibility rights original'));

 return{format:'GomokuA24FieldOriginalIntake',version:24,sourceSha:PIN.sourceSha,
  a23Head:HEAD,humanOwnerApproval:'NOT_OBTAINED',releaseState:'NO_GO',
  physicalCasesAccepted:0,productionDataTouched:false,
  cases:[{platform:'android-chrome',caseId:'fresh-launch',status:'OBSERVED_PENDING_INDEPENDENT_REVIEW',
   originalFile:'media/android-chrome/fresh-launch.bin',sha256:A.sha(a),
   ownerRightsIntakeSha256:A.sha(Buffer.from('SYNTHETIC rights document for first device case')),hardwareModel:'NOT REAL PIXEL',androidVersion:'NOT REAL ANDROID 15',
   browserVersion:'SYNTHETIC CHROME',operatorId:'FAKE OPERATOR',observedAt:'2026-10-10T18:00:00Z',
   observation:'This is deliberately synthetic local testing, not an observed physical device.'}],
  accessibility:[{id:'screen-reader',status:'OBSERVED_PENDING_INDEPENDENT_REVIEW',
   originalFile:'assistive/screen-reader.bin',sha256:A.sha(b),
   ownerRightsIntakeSha256:A.sha(Buffer.from('SYNTHETIC independent accessibility rights original')),assistiveTechnology:'FAKE TALKBACK',
   operatorId:'FAKE OPERATOR',observedAt:'2026-10-10T18:01:00Z',
   observation:'Synthetic screen reader bytes are not independent physical accessible observations.'}]};
}
function host(){
 const o=C.template({previewOrigin:'https://fake-original-receipt.vercel.app/',operatorId:'FAKE EXTERNAL OPERATOR'});
 o.captureTool='SYNTHETIC FILE COPIER ONLY';
 for(const r of o.responses){
  const data=fs.readFileSync(path.join(BASE,r.asset));
  file('captured/'+r.asset,data);
  Object.assign(r,{status:200,redirected:false,credentialsSent:false,cookiesSent:false,
   hasSetCookie:false,originalResponseUrl:r.originalRequestUrl,
   capturedSha256:A.sha(data),providerObjectSha256:A.sha(data),
   byteLength:data.length,capturedAt:'2026-10-10T18:02:00Z'});
 }
 return o;
}
function rollback(){
 const orig=Buffer.from('SYNTHETIC ORIGINAL LAST DEPLOYED NEVER ACTUALLY DEPLOYED');
 const before=Buffer.from('SYNTHETIC PREVIOUS SW'),update=Buffer.from('SYNTHETIC NEW SW');
 file('prior/previous-stable.bin',orig);file('sw/before.bin',before);
 file('sw/updated.bin',update);file('sw/reverted.bin',before);
 return{format:'GomokuA24OfflineRollbackReview',version:24,
  a23Head:HEAD,originalA9SourceSha:PIN.sourceSha,
  ownerRestoreApproval:'NOT_OBTAINED',realSameOriginUpdatePerformed:false,
  realPlayerDataRestored:false,realProductionTouched:false,
  observedAt:'2026-10-10T18:04:00Z',previousStableSha256:A.sha(orig),
  beforeSwSha256:A.sha(before),updatedSwSha256:A.sha(update),revertedSwSha256:A.sha(before)};
}
function review(o={}){return H.review({fieldManifest:field(),fieldRoot:TMP,rightsRoot:TMP,now:NOW,...o})}
try{
 t('original immutable A9 source files staged, exact head pinned',()=>{
  assert(fs.existsSync(path.join(BASE,'index.html')));assert.equal(PIN.sourceSha,'fca45816ed7d3a95bae550b9aa644e29053875f6');
 });
 t('one physical plus one accessible source supports partial offline review with no acceptance',()=>{
  const r=review();assert.equal(r.coverage.originalPhysicalPending,1);
  assert.equal(r.coverage.originalAccessibilityPending,1);
  assert.equal(r.coverage.actualPhysicalAccepted,0);assert.equal(r.decision,'NO_GO');
  assert.equal(r.reviewChecklist.length,8);assert.equal(r.conflicts.length,0);
 });
 t('real archived A9 CI bytes match all eight submitted synthetic host files without actual live preview',()=>{
  const r=review({hostManifest:host(),hostRoot:TMP,a9OriginalRoot:BASE});
  assert.equal(r.coverage.originalHostedBytesVerifiedOffline,8);
  assert.equal(r.coverage.independentlyAuthenticatedHostedOrigin,0);
  assert.equal(r.ownerApproved,false);
 });
 t('rollback original SW differs and reverts, not actual original deployed state',()=>{
  const r=review({rollbackManifest:rollback(),rollbackRoot:TMP});
  assert.equal(r.coverage.originalRollbackByteSetsReviewedOffline,1);
  assert.equal(r.coverage.actualRestoredPlayerState,0);
 });
 t('all three original-source packets can be reviewed without authority',()=>{
  const r=review({hostManifest:host(),hostRoot:TMP,a9OriginalRoot:BASE,
   rollbackManifest:rollback(),rollbackRoot:TMP});
  assert.equal(r.evidence.field.length,2);assert.equal(r.evidence.host.length,8);
  assert.equal(r.evidence.rollback.length,4);assert.equal(r.status,'PENDING_EXTERNAL_EVIDENCE_REVIEW');
  for(const flag of ['canMerge','canTag','canDeploy','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])
   assert.equal(r[flag],false);
 });
 t('partial optional host source arguments must all be present',()=>{
  assert.throws(()=>review({hostManifest:host()}),/host manifest, original host bodies/);
 });
 t('partial optional prior-stable parameters fail closed',()=>{
  assert.throws(()=>review({rollbackManifest:rollback()}),/distinct prior-stable manifest/);
 });
 t('unknown parent or qualified source rejected',()=>{
  const m=field();m.a23Head='0'.repeat(40);
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,rightsRoot:TMP,now:NOW}),/Rejected A24/);
 });
 t('field physical approval accidentally set true always blocked',()=>{
  const m=field();m.physicalCasesAccepted=1;
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,now:NOW}),/Rejected A24/);
 });
 t('altered physical file after original SHA receipt always blocks',()=>{
  const m=field();file('media/android-chrome/fresh-launch.bin',Buffer.from('MUTATED'));
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,now:NOW}),/SHA mismatch/);
 });
 t('duplicate physical media across categories rejected',()=>{
  const m=field();m.accessibility[0].sha256=m.cases[0].sha256;
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,now:NOW}),/accessibility original media/);
 });
 t('replaced hosted body with matching forged manifest SHA still rejected against real A9',()=>{
  const h=host(),fake=Buffer.from('UNAUTHORIZED MODIFIED LIVE SERVER BODY');
  file('captured/index.html',fake);
  h.responses[0].capturedSha256=A.sha(fake);h.responses[0].providerObjectSha256=A.sha(fake);
  h.responses[0].byteLength=fake.length;
  assert.throws(()=>review({hostManifest:h,hostRoot:TMP,a9OriginalRoot:BASE}),/does not match immutable A9/);
 });
 t('host redirects and cookie-bearing original responses never accepted',()=>{
  const h=host();h.responses[0].cookiesSent=true;
  assert.throws(()=>review({hostManifest:h,hostRoot:TMP,a9OriginalRoot:BASE}),/Rejected original response metadata/);
 });
 t('production host alias cannot be substituted into offline manifests',()=>{
  const h=host();h.previewOrigin='https://gomoku.thiepn.dev/';
  assert.throws(()=>review({hostManifest:h,hostRoot:TMP,a9OriginalRoot:BASE}),/Preview/);
 });
 t('tampered original RIGHTS bytes fail source custody and never grant rights',()=>{
  const m=field();file('rights/android-chrome/fresh-launch.bin',Buffer.from('TAMPERED RIGHTS MEDIA'));
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,rightsRoot:TMP,now:NOW}),/rights ORIGINAL bytes mismatch/);
 });
 t('missing independent original rights file is rejected even if metadata SHA exists',()=>{
  const m=field();fs.unlinkSync(path.join(TMP,'rights/android-chrome/fresh-launch.bin'));
  assert.throws(()=>H.review({fieldManifest:m,fieldRoot:TMP,rightsRoot:TMP,now:NOW}),/missing or unsafe separately preserved original rights/);
 });
 t('no synthetic previous stable can be named as A9 original candidate ZIP',()=>{
  const r=rollback();r.previousStableSha256=PIN.offlineZipSha256;
  assert.throws(()=>review({rollbackManifest:r,rollbackRoot:TMP}),/Rollback review/);
 });
 t('rollbacks cannot pretend player state was genuinely restored',()=>{
  const r=rollback();r.realPlayerDataRestored=true;
  assert.throws(()=>review({rollbackManifest:r,rollbackRoot:TMP}),/Rollback review/);
 });
 t('read-only prior review source chain with no changes contains no disputes',()=>{
  const r=review();const v=review({previous:r});
  assert.equal(v.conflicts.length,0);assert.equal(v.manualResolutionRequired,false);
 });
 t('changed original media with new valid receipt is a HUMAN CUSTODY CONFLICT',()=>{
  const old=review();
  const m=field(),changed=Buffer.from('ALTERNATE FAKE ORIGINAL DEVICE MEDIA');
  file('media/android-chrome/fresh-launch.bin',changed);m.cases[0].sha256=A.sha(changed);
  const newer=H.review({fieldManifest:m,fieldRoot:TMP,rightsRoot:TMP,previous:old,now:NOW});
  assert.equal(newer.manualResolutionRequired,true);assert.equal(newer.conflicts.length,1);
  assert.equal(newer.conflicts[0].id,'android-chrome:fresh-launch');
  assert.equal(newer.canCertifyPhysical,false);assert.equal(newer.status,'BLOCKED_ORIGINAL_CUSTODY_CONFLICT');
 });
 t('untrusted historical review format never used as authoritative source',()=>{
  assert.throws(()=>review({previous:{format:'FAKE',evidence:{}}}),/prior handoff is untrusted/);
 });
 t('forged historical digest detected before collision adjudication',()=>{
  const old=review();old.evidence.field[0].sha256='f'.repeat(64);
  assert.throws(()=>review({previous:old}),/prior handoff is untrusted/);
 });
 t('CLI writes private immutable NO_GO original handoff and refuses overwrite',()=>{
  const m=field(),inp=file('cli-input-field.json',Buffer.from(JSON.stringify(m)));
  const dest=path.join(TMP,'CLI-HANDOFF.json');
  const args=[path.resolve(__dirname,'a25-handoff.cjs'),'--field-manifest',inp,'--field-root',TMP,'--rights-root',TMP,'--out',dest];
  const r=cp.spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const output=JSON.parse(fs.readFileSync(dest));assert.equal(output.decision,'NO_GO');
  assert.equal(output.coverage.actualPhysicalAccepted,0);
  assert.equal(fs.statSync(dest).mode&0o077,0);
  assert.notEqual(cp.spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);
 });
 t('CLI rejects missing original field sources entirely',()=>{
  const r=cp.spawnSync(process.execPath,[path.resolve(__dirname,'a25-handoff.cjs')],{encoding:'utf8'});
  assert.notEqual(r.status,0);assert(r.stderr.includes('A25 original handoff blocked'));
 });
 t('the report never includes the byte buffers, credentials, or human approval',()=>{
  const r=review({hostManifest:host(),hostRoot:TMP,a9OriginalRoot:BASE});
  const json=JSON.stringify(r);
  assert(!json.includes('SYNTHETIC original physical-media content A25'));
  assert.equal(r.originalBinaryMediaIncluded,false);
  assert.equal(r.secretOrCredentialIncluded,false);
  assert.equal(r.realSignerRoots,0);assert.equal(r.realCutoverPerformed,false);assert.equal(r.realA13Hours,0);
 });
}finally{fs.rmSync(TMP,{recursive:true,force:true})}
console.log(n+' A25 original-file/provider/restore/human handoff adversarial tests passed. NO real host/device/human evidence.');
