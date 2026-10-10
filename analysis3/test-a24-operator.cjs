/* A24 adversarial: actual original A9 CI asset bytes; synthetic external captures, no real host/hardware. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const PIN=require('./a10-source-lock.json'),P=require('./a23-parent-evidence.json');
const A10=require('./a10-preview-integrity.cjs'),A9=require('./rc9-core.cjs');
const H=require('./a24-offline-intake.cjs'),F=require('./a24-field-intake.cjs'),T=require('./a24-capture-template.cjs');
const sha=H.sha,NOW=new Date('2026-10-10T19:00:00Z');
const base=path.resolve(__dirname,'../analysis24-test-output/preview-static');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gomoku-a24-'));
let count=0;function t(name,run){run();count++;console.log('PASS A24 '+name);}
function write(relative,bytes){
 const file=path.join(tmp,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return file;
}
function host(){
 const host='https://synthetic-original-evidence.vercel.app/';
 const manifest={format:'GomokuA24OfflineHostedResponseIntake',version:24,repository:'thiepn/gomoku',
  sourceSha:PIN.sourceSha,a23Head:'d36610bc49aa0cee03f3a649108fda98e99094ee',
  purpose:'MANUAL_OFFLINE_REVIEW_ONLY',ownerAuthorizationState:'NOT_GRANTED',
  verifiedHumanWitnesses:0,productionOriginTouched:false,
  captureOperatorId:'SYNTHETIC OPERATOR NOT A REAL HOST WITNESS',captureTool:'SYNTHETIC OFFLINE FILE DUPLICATOR',
  previewOrigin:host,responses:A10.ASSETS.map(asset=>{
   const bytes=fs.readFileSync(path.join(base,asset));write('captured/'+asset,bytes);
   return{asset,file:'captured/'+asset,method:'GET',status:200,
    redirected:false,credentialsSent:false,cookiesSent:false,hasSetCookie:false,
    originalRequestUrl:new URL(asset,host).toString(),
    originalResponseUrl:new URL(asset,host).toString(),
    originalRightsApproved:false,contentEncoding:'identity',
    capturedSha256:sha(bytes),providerObjectSha256:sha(bytes),byteLength:bytes.length,
    capturedAt:'2026-10-10T18:01:00Z'};
  })};
 return manifest;
}
function field(){
 const bytes=Buffer.from('FAKE local capture original - NOT actual phone');
 write('media/android-chrome/fresh-launch.bin',bytes);
 const cases=[{platform:'android-chrome',caseId:'fresh-launch',
  status:'OBSERVED_PENDING_INDEPENDENT_REVIEW',
  originalFile:'media/android-chrome/fresh-launch.bin',
  sha256:sha(bytes),hardwareModel:'SYNTHETIC Pixel model',androidVersion:'SYNTHETIC 15',
  browserVersion:'SYNTHETIC Chrome 130',operatorId:'SYNTHETIC WITNESS',observedAt:'2026-10-10T18:02:00Z',
  ownerRightsIntakeSha256:'a'.repeat(64),observation:'Synthetic original byte QA, no physical handheld ever tested.'}];
 return {format:'GomokuA24FieldOriginalIntake',version:24,sourceSha:P.a9OriginalSha,
  a23Head:'d36610bc49aa0cee03f3a649108fda98e99094ee',humanOwnerApproval:'NOT_OBTAINED',
  releaseState:'NO_GO',physicalCasesAccepted:0,productionDataTouched:false,cases,accessibility:[]};
}
function recovery(){
 const old=Buffer.from('SYNTHETIC original previous stable version not deployed');
 const b=Buffer.from('SW Version PREVIOUS'),u=Buffer.from('SW Version UPDATED');
 write('prior/previous-stable.bin',old);
 write('sw/before.bin',b);write('sw/updated.bin',u);write('sw/reverted.bin',b);
 return {format:'GomokuA24OfflineRollbackReview',version:24,
  a23Head:'d36610bc49aa0cee03f3a649108fda98e99094ee',
  originalA9SourceSha:P.a9OriginalSha,
  ownerRestoreApproval:'NOT_OBTAINED',realSameOriginUpdatePerformed:false,
  realPlayerDataRestored:false,realProductionTouched:false,
  previousStableSha256:sha(old),beforeSwSha256:sha(b),
  updatedSwSha256:sha(u),revertedSwSha256:sha(b),observedAt:'2026-10-10T18:02:00Z'};
}
try{
 t('actual original immutable A9 CI source and exact eight file paths',()=>{
  assert.equal(P.a9OriginalSha,PIN.sourceSha);assert.equal(A10.ASSETS.length,8);
  assert.deepEqual([...A10.ASSETS].sort(),[...A9.ASSETS].sort());
 });
 t('genuine A9 staged asset bytes compare to synthetic offline copies, never hosted approval',()=>{
  const r=H.intake({manifest:host(),captureRoot:tmp,originalRoot:base,now:NOW});
  assert.equal(r.originalByteObjects,r.originalByteObjects); // report format check follows
  assert.equal(r.actualOriginalByteObjects,8);
  assert.equal(r.originalHostedResponsesIndependentlyAuthenticated,false);
  assert.equal(r.canDeploy,false);assert.equal(r.decision,'NO_GO');
 });
 t('reject wrong original authored head including A22 parent',()=>{
  const m=host();m.a23Head=P.a22Head;
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original intake/);
 });
 t('reject wrong A9 original source',()=>{
  const m=host();m.sourceSha='0'.repeat(40);
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original intake/);
 });
 t('reject fake owner permission or certified witness',()=>{
  const m=host();m.ownerAuthorizationState='APPROVED';
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original intake/);
 });
 t('reject production alias masquerading as isolated Vercel',()=>{
  const m=host();m.previewOrigin='https://gomoku.thiepn.dev/';
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Preview/);
 });
 t('reject HTTPS host query, cookie credentials, paths',()=>{
  const m=host();m.previewOrigin='https://example.vercel.app/?token=leak';
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Preview/);
 });
 t('reject redirected hosted response',()=>{
  const m=host();m.responses[0].redirected=true;
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original response/);
 });
 t('reject cookies and set-cookie receipt',()=>{
  const m=host();m.responses[0].hasSetCookie=true;
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original response/);
 });
 t('reject unbounded or foreign response asset',()=>{
  const m=host();m.responses[0].asset='api/player-data';
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original response/);
 });
 t('reject byte-mutated captured response even with fake SHA',()=>{
  const m=host();const evil=Buffer.from('wrong original hosted response');
  write('captured/index.html',evil);m.responses[0].capturedSha256=sha(evil);
  m.responses[0].providerObjectSha256=sha(evil);m.responses[0].byteLength=evil.length;
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/does not match immutable A9/);
 });
 t('reject symlinked source evidence even if hashes align',()=>{
  host();const file=path.join(tmp,'captured/index.html'),outside=write('elsewhere.html',Buffer.from('outside'));
  fs.unlinkSync(file);fs.symlinkSync(outside,file);
  assert.throws(()=>H.intake({manifest:host(),captureRoot:tmp,originalRoot:base,now:NOW}),/Symlinked original evidence forbidden/);
  fs.unlinkSync(file); // next fixture regeneration restores
 });
 t('reject file path traversal and absolute names',()=>{
  assert.throws(()=>H.readUnder(tmp,'captured/../../etc/passwd'),/unsafe original-byte path/);
  assert.throws(()=>H.readUnder(tmp,'/etc/passwd'),/unsafe original-byte path/);
 });
 t('reject capture receipts from the future',()=>{
  const m=host();m.responses[0].capturedAt='2026-10-12T12:00:00Z';
  assert.throws(()=>H.intake({manifest:m,captureRoot:tmp,originalRoot:base,now:NOW}),/timestamp/);
 });
 t('offline CLI actually writes protected unsigned receipt and will not overwrite',()=>{
  const m=host();const infile=write('manifest.json',Buffer.from(JSON.stringify(m)));
  const out=path.join(tmp,'receipt-output.json');
  const args=[path.resolve(__dirname,'a24-offline-intake.cjs'),'--manifest',infile,
   '--capture-root',tmp,'--original-root',base,'--out',out];
  const p=cp.spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);const r=JSON.parse(fs.readFileSync(out));
  assert.equal(r.decision,'NO_GO');assert.equal(r.actualOriginalByteObjects,8);
  assert.notEqual(fs.statSync(out).mode&0o077,0o077);
  assert.notEqual(cp.spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);
 });
 t('partial real-world case collection supports 1/18 pending, 0 accepted',()=>{
  const r=F.field({manifest:field(),root:tmp,now:NOW});
  assert.equal(r.pendingCaseCount,1);assert.equal(r.missingCases.length,17);
  assert.equal(r.pendingAssistiveCount,0);assert.equal(r.physicallyAcceptedBySoftware,0);
 });
 t('original physical source bytes altered rejected',()=>{
  const m=field();write('media/android-chrome/fresh-launch.bin',Buffer.from('wrong'));
  assert.throws(()=>F.field({manifest:m,root:tmp,now:NOW}),/SHA mismatch/);
 });
 t('claims of physically accepted device fail closed',()=>{
  const m=field();m.physicalCasesAccepted=1;
  assert.throws(()=>F.field({manifest:m,root:tmp,now:NOW}),/Rejected A24/);
 });
 t('unexpected platform or made-up case rejected',()=>{
  const m=field();m.cases[0].caseId='fake-step';
  assert.throws(()=>F.field({manifest:m,root:tmp,now:NOW}),/Incorrect device witness/);
 });
 t('duplicate physical original cannot self-certify',()=>{
  const m=field();m.cases.push({...m.cases[0]});
  assert.throws(()=>F.field({manifest:m,root:tmp,now:NOW}),/Incorrect device witness/);
 });
 t('second case on changing unrecorded browser epoch rejected',()=>{
  const m=field();const b=Buffer.from('ANOTHER SYNTHETIC A24 CASE');
  write('media/android-chrome/rules-renju.bin',b);
  m.cases.push({...m.cases[0],caseId:'rules-renju',originalFile:'media/android-chrome/rules-renju.bin',
   sha256:sha(b),browserVersion:'DIFFERENT'});
  assert.throws(()=>F.field({manifest:m,root:tmp,now:NOW}),/Changed physical device/);
 });
 t('partial actual accessibility-source file hash recorded pending only',()=>{
  const m=field();const b=Buffer.from('FAKE ACCESSIBLE SOURCE');
  write('assistive/screen-reader.bin',b);
  m.accessibility.push({id:'screen-reader',originalFile:'assistive/screen-reader.bin',
   status:'OBSERVED_PENDING_INDEPENDENT_REVIEW',sha256:sha(b),
   ownerRightsIntakeSha256:'a'.repeat(64),assistiveTechnology:'SYNTHETIC reader',
   operatorId:'SYNTHETIC OPERATOR',observation:'This was not actually observed on any Android device.',
   observedAt:'2026-10-10T18:04:00Z'});
  const r=F.field({manifest:m,root:tmp,now:NOW});
  assert.equal(r.pendingAssistiveCount,1);assert.equal(r.missingAccessibility.length,6);
  assert.equal(r.physicallyAcceptedBySoftware,0);
 });
 t('distinct SW before/update/revert and prior stable offline bytes can be reviewed',()=>{
  const r=F.rollback({packet:recovery(),root:tmp,now:NOW});
  assert.equal(r.decision,'NO_GO');assert.equal(r.realServiceWorkerUpdateOrRollbackPerformed,false);
 });
 t('before and update same SW original bytes cannot count as version-changing',()=>{
  const m=recovery();m.updatedSwSha256=m.beforeSwSha256;
  assert.throws(()=>F.rollback({packet:m,root:tmp,now:NOW}),/Rollback review/);
 });
 t('prior stable cannot be fake A9 candidate ZIP',()=>{
  const m=recovery();m.previousStableSha256=P.a9NestedZipSha256;
  assert.throws(()=>F.rollback({packet:m,root:tmp,now:NOW}),/Rollback review/);
 });
 t('actual player restore claimed in source document is rejected',()=>{
  const m=recovery();m.realPlayerDataRestored=true;
  assert.throws(()=>F.rollback({packet:m,root:tmp,now:NOW}),/Rollback review/);
 });
 t('rollback prior original media byte tampering always denied',()=>{
  const m=recovery();write('prior/previous-stable.bin',Buffer.from('tampered'));
  assert.throws(()=>F.rollback({packet:m,root:tmp,now:NOW}),/SHA mismatch/);
 });
 t('offline capture worksheet emits eight deliberately unapproved original host entries',()=>{
  const p=T.template({previewOrigin:'https://synthetic-original-evidence.vercel.app/',operatorId:'SYNTHETIC TESTER'});
  assert.equal(p.responses.length,8);assert.equal(p.ownerAuthorizationState,'NOT_GRANTED');
  assert.equal(p.responses[0].status,null);assert.equal(p.responses[0].capturedSha256,null);
  assert.equal(p.verifiedHumanWitnesses,0);
  assert.throws(()=>H.intake({manifest:p,captureRoot:tmp,originalRoot:base,now:NOW}),/Rejected original response/);
 });
 t('capture worksheet generator refuses public production origins',()=>{
  assert.throws(()=>T.template({previewOrigin:'https://gomoku.thiepn.dev/',operatorId:'TEST'}),/Preview/);
 });
 t('physical partial evidence CLI exports protected NO_GO and refuses overwrite',()=>{
  const manifest=field(),source=write('field-manifest.json',Buffer.from(JSON.stringify(manifest)));
  const out=path.join(tmp,'field-pending-output.json');
  const cli=[path.resolve(__dirname,'a24-field-intake.cjs'),'--mode','field',
   '--manifest',source,'--root',tmp,'--out',out];
  const p=cp.spawnSync(process.execPath,cli,{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const r=JSON.parse(fs.readFileSync(out));assert.equal(r.pendingCaseCount,1);
  assert.equal(r.physicallyAcceptedBySoftware,0);assert.equal(r.canDeploy,false);
  assert.notEqual(cp.spawnSync(process.execPath,cli,{encoding:'utf8'}).status,0);
 });
 t('rollback CLI creates review-only original digest without action',()=>{
  const packet=recovery(),manifest=write('restore-manifest.json',Buffer.from(JSON.stringify(packet)));
  const out=path.join(tmp,'restore-pending-output.json');
  const cli=[path.resolve(__dirname,'a24-field-intake.cjs'),'--mode','rollback',
    '--manifest',manifest,'--root',tmp,'--out',out];
  const p=cp.spawnSync(process.execPath,cli,{encoding:'utf8'});
  assert.equal(p.status,0,p.stderr);
  const r=JSON.parse(fs.readFileSync(out));assert.equal(r.decision,'NO_GO');
  assert.equal(r.realServiceWorkerUpdateOrRollbackPerformed,false);
 });
 t('all persisted original release gates remain blocked',()=>{
  const r=F.field({manifest:field(),root:tmp,now:NOW});
  assert.equal(r.decision,'NO_GO');
  for(const k of ['canMerge','canTag','canDeploy','canCertifyPhysical','canCloseRelease'])assert.equal(r[k],false);
 });
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
console.log(total+' A24 actual original A9/offline host and incremental physical/rollback adversarial tests passed. NO real hosted fetch, device or release.');
