/* Synthetic external operators/devices ONLY. Real A9 CI file source verified; NO real authority. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A14=require('./a14-custody.cjs'),W=require('./a18-signer-reconciliation.cjs');
const P=require('./a23-parent-evidence.json'),A9=require('./rc9-core.cjs');
const E=require('./a23-multicustodian.cjs'),I=require('./a23-incidents.cjs'),A=require('./a23-acceptance.cjs');
const HASH=E.sha,NOW=new Date('2026-10-10T20:00:00Z'),a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
const nonce='d'.repeat(32);let total=0;function check(name,f){f();total++;console.log('PASS A23 '+name)}
const secret={},keys=['custodian','reviewer'].map((role,i)=>{
 const kp=crypto.generateKeyPairSync('ed25519');secret[role]=kp.privateKey;
 return{role,keyId:'SYNTHETIC-KEY-'+i,person:'FAKE PERSON '+i,publicKeyPem:kp.publicKey.export({format:'pem',type:'spki'}),
  spkiSha256:HASH(kp.publicKey.export({format:'der',type:'spki'}))};
});
const roots={format:'GomokuA23WitnessRegistry',version:23,keys,revokedKeyIds:[]};
function original(){
 const objects={a9:fs.readFileSync(path.resolve(__dirname,'../analysis23-test-output/preview-static/index.html')),
  fake:Buffer.from('SYNTHETIC dummy external service response, NOT hosted')};
 let root='e'.repeat(64);
 const receipts=Object.entries(objects).map(([id,buf],i)=>{
  const row={sequence:i+1,id,kind:i===0?'original-a9':'isolated-preview',
   sha256:HASH(buf),byteLength:buf.length,previousRoot:root,
   collectedAt:'2026-10-10T19:0'+i+':00Z',providerId:'SYNTHETIC PROVIDER',
   issuerId:'SEPARATE SYNTHETIC ISSUER',realAuthorizationObtained:false,rightsSha256:a};
  row.receiptRoot=W.hash(row);root=row.receiptRoot;return row;
 });
 const packet={format:'GomokuA23MultiCustodianEscrow',version:23,repository:'thiepn/gomoku',
  sourceSha:P.a9OriginalSha,a22Head:P.a22Head,previousRoot:'e'.repeat(64),
  ownerOriginalRights:'NOT_APPROVED',externalProviderAuthenticated:false,
  realHostTouched:false,actualHumanApproval:false,productionDataIncluded:false,
  originalPacketDigest:a,receipts,finalRoot:root};
 const payload={sourceSha:P.a9OriginalSha,a22Head:P.a22Head,previousRoot:packet.previousRoot,
  finalRoot:packet.finalRoot,originalPacketDigest:packet.originalPacketDigest,
  originalReceiptListDigest:W.hash(receipts)};
 const sig=['custodian','reviewer'].map(role=>({role,keyId:keys.find(x=>x.role===role).keyId,
  person:keys.find(x=>x.role===role).person,
  signature:crypto.sign(null,Buffer.from(A14.canonical(payload)),secret[role]).toString('base64')}));
 return {packet,objects,prior:{status:'external-original-receipts-documentary-only',finalRoot:packet.previousRoot},
  roots,signatures:sig,now:NOW};
}
function incident(){
 const originalProviderBytes=Buffer.from('SYNTHETIC original replay provider bytes, never global service');
 const entry=[
  {action:'issue',operator:'SYNTHETIC A',scopeSha256:a},
  {action:'consume',operator:'SYNTHETIC B',scopeSha256:a},
  {action:'compromise',operator:'SYNTHETIC C',keyId:'OLD-KEY',keyOwner:'SYNTHETIC D',
   fingerprintSha256:b,separateOwnerReceiptSha256:a},
  {action:'rotate',operator:'SYNTHETIC E',replacedKeyId:'OLD-KEY',
   replacedFingerprintSha256:b,newKeyId:'NEW-KEY',newFingerprintSha256:c,
   independentWitnessReceiptSha256:a},
  {action:'recover-review',operator:'SYNTHETIC C',previousStableOriginalSha256:c,
   recoveryActuallyPerformed:false,isolatedRestoreReceiptSha256:b}
 ];
 let root='1'.repeat(64);
 const events=entry.map((row,i)=>{const event={...row,sequence:i+1,
   challenge:nonce,originalEvidenceSha256:a,parentRoot:root,
   nextRoot:HASH(Buffer.from('SYNTHETIC PROVIDER CAS '+i)),
   eventSha256:HASH(Buffer.from('SYNTHETIC UNIQUE EVENT '+i)),
   at:'2026-10-10T19:0'+i+':00Z'};root=event.nextRoot;return event;});
 const packet={format:'GomokuA23MultiProviderIncident',version:23,
  a22Head:P.a22Head,originalSourceSha:P.a9OriginalSha,ownerPermission:'OPEN',
  globalLedgerActuallyOperated:false,realKeyRotated:false,productionRestoreExecuted:false,
  initialRoot:'1'.repeat(64),finalRoot:root,providerObjectSha256:HASH(originalProviderBytes),
  events,revokedKeyIds:['OLD-KEY']};
 return{packet,originalProviderBytes,sourceJournal:{entries:[{action:'issue',challenge:nonce},{action:'consume',challenge:nonce}]},
  prior:{status:'incident-originals-documentary-only'},now:NOW};
}
function physical(){
 const cases=[],objects={},assistive=[],assBytes={};
 for(const [platform,names] of Object.entries(A9.DEVICE_CHECKS)){
  for(const caseId of names){const id=platform+':'+caseId,bytes=Buffer.from('FAKE A23 ANDROID MEDIA '+id);
   objects[id]=bytes;
   cases.push({platform,caseId,sha256:HASH(bytes),status:'unapproved-independent-review',
    deviceId:'SYNTHETIC '+platform,osVersion:'Fake Android 15',
    browserVersion:'Fake Browser 130',operatorId:'SYNTHETIC OPERATOR',
    originalRightsDigest:b,at:'2026-10-10T19:05:00Z'});
  }
 }
 for(const name of require('./a21-hardware.cjs').ACCESS){const bytes=Buffer.from('FAKE A23 ACCESSIBLE MEDIA '+name);
  assBytes[name]=bytes;assistive.push({id:name,sha256:HASH(bytes),status:'pending-human-accessibility-review',
   independentRightsDigest:b,at:'2026-10-10T19:06:00Z'});
 }
 const swBytes={before:Buffer.from('SYNTHETIC SW VERSION ONE'),update:Buffer.from('SYNTHETIC SW VERSION TWO'),
  revert:Buffer.from('SYNTHETIC SW VERSION ONE')};
 const priorStableBytes=Buffer.from('SYNTHETIC UNDEPLOYED PRIOR IMAGE, no personal state');
 const packet={format:'GomokuA23PhysicalOriginals',version:23,sourceSha:P.a9OriginalSha,a22Head:P.a22Head,
  ownerHumanApproval:'OPEN',deviceAcceptanceStatus:'0/18',physicalAccepted:0,
  productionDataTouched:false,cases,assistive,sw:{
   format:'GomokuA23OriginalSW',versions:['before','update','revert'],realUpdatePerformed:false,
   beforeSha256:HASH(swBytes.before),updateSha256:HASH(swBytes.update),revertSha256:HASH(swBytes.revert)},
  priorStable:{format:'GomokuA23PriorStableOriginal',sha256:HASH(priorStableBytes),
   realRestorePerformed:false,playerDataAccessed:false}};
 return{packet,physical:objects,assistive:assBytes,swBytes,priorStableBytes,
  upstream:{status:'physical-witness-originals-documentary-only'},now:NOW};
}
check('exact A22 head pinned, independent source trust registries EMPTY',()=>{
 assert.equal(P.a22Head,'c1456dcadc5de43f8dfee97925593882203f504f');
 assert.equal(P.runs.length,6);assert.equal(P.realSignerRoots.length,0);assert.equal(A.status().status,'NO_GO');
});
check('two synthetic cryptographic original custodians document-only, not accepted',()=>{
 const r=E.inspect(original());assert.equal(r.status,'multi-custodian-originals-documentary-only',r.reason);
 assert.equal(r.realProviderAuthenticated,false);assert.equal(r.canDeploy,false);
});
check('genuine source-controlled roots remain empty',()=>{
 const x=original();x.roots={format:'GomokuA23WitnessRegistry',version:23,keys:[],revokedKeyIds:[]};
 assert.equal(E.inspect(x).status,'blocked-actual-roots');
});
check('tampered external body rejected',()=>{
 const x=original();x.objects.fake=Buffer.from('EVIL');
 assert.equal(E.inspect(x).status,'blocked-original-receipt');
});
check('duplicate original content forbidden',()=>{
 const x=original();x.packet.receipts[1].sha256=x.packet.receipts[0].sha256;
 assert.equal(E.inspect(x).status,'blocked-original-receipt');
});
check('removed original body rejected',()=>{
 const x=original();delete x.objects.fake;assert.equal(E.inspect(x).status,'blocked-original-receipt');
});
check('owner rights lie cannot be approved by packet',()=>{
 const x=original();x.packet.ownerOriginalRights='APPROVED';
 assert.equal(E.inspect(x).status,'blocked-original-scope');
});
check('custodian is not allowed to self-issue original',()=>{
 const x=original();x.packet.receipts[0].issuerId=x.packet.receipts[0].providerId;
 assert.equal(E.inspect(x).status,'blocked-original-receipt');
});
check('revoked supplied Ed25519 witness denied',()=>{
 const x=original();x.roots={...roots,revokedKeyIds:[keys[0].keyId]};
 assert.equal(E.inspect(x).status,'blocked-witness-independence');
});
check('signature of wrong original digest denied',()=>{
 const x=original();x.signatures[0].signature='A'.repeat(88);
 assert.equal(E.inspect(x).status,'blocked-witness-signature');
});
check('one real person cannot control both reviewer and custodian roles',()=>{
 const x=original();x.roots={...roots,keys:[keys[0],{...keys[1],person:keys[0].person}]};
 assert.equal(E.inspect(x).status,'blocked-witness-independence');
});
check('conflicting independent provider original receipt roots never auto-selected',()=>{
 const x=original(),right=structuredClone(x.packet.receipts);
 right[1].receiptRoot='f'.repeat(64);
 const r=E.fork({commonRoot:x.packet.previousRoot,branches:[
  {providerId:'independent A',receipts:x.packet.receipts},{providerId:'independent B',receipts:right}]});
 assert.equal(r.status,'escrow-source-conflict',r.reason);assert.equal(r.automaticWinner,null);
});
check('independent cross-operator replay/key compromise/rotation remains documentary',()=>{
 const r=I.reconcile(incident());assert.equal(r.status,'multi-provider-incident-documentary-only',r.reason);
 assert.deepEqual(r.revokedKeyIds,['OLD-KEY']);assert.deepEqual(r.replacementKeyIds,['NEW-KEY']);
});
check('tampered original provider bytes rejected',()=>{
 const x=incident();x.originalProviderBytes=Buffer.from('tampered');
 assert.equal(I.reconcile(x).status,'blocked-incident-origin');
});
check('source CAS fork rejected',()=>{
 const x=incident();x.packet.events[1].parentRoot=a;
 assert.equal(I.reconcile(x).status,'blocked-provider-sequence');
});
check('double consume cannot race',()=>{
 const x=incident();x.packet.events[1].operator='SYNTHETIC A';
 assert.equal(I.reconcile(x).status,'blocked-replay-consume');
});
check('self revocation/collusion rejected',()=>{
 const x=incident();x.packet.events[2].operator='SYNTHETIC D';
 assert.equal(I.reconcile(x).status,'blocked-key-revocation');
});
check('revoked key fingerprint swapped rejected',()=>{
 const x=incident();x.packet.events[3].replacedFingerprintSha256=a;
 assert.equal(I.reconcile(x).status,'blocked-key-rotation');
});
check('recovering operator must differ from original consumer and issuer',()=>{
 const x=incident();x.packet.events[4].operator='SYNTHETIC B';
 assert.equal(I.reconcile(x).status,'blocked-recovery-review');
});
check('actual restore attempt cannot appear in documentary source',()=>{
 const x=incident();x.packet.events[4].recoveryActuallyPerformed=true;
 assert.equal(I.reconcile(x).status,'blocked-recovery-review');
});
check('operator conflicts are unresolved and no CAS winner chosen',()=>{
 const ps=[{format:'GomokuA23IncidentProposal',a22Head:P.a22Head,sourceSha:P.a9OriginalSha,
   baseRoot:a,challenge:nonce,originalPacketSha256:a,action:'consume',operator:'A',executed:false},
  {format:'GomokuA23IncidentProposal',a22Head:P.a22Head,sourceSha:P.a9OriginalSha,
   baseRoot:a,challenge:nonce,originalPacketSha256:b,action:'consume',operator:'B',executed:false}];
 const r=I.conflict({packets:ps,sourceRoot:a});assert.equal(r.status,'provider-originals-conflict');assert.equal(r.automaticWinner,null);
});
check('exact 18+7 media and distinct SW/prior-stable original buffers never physical acceptance',()=>{
 const r=A.inspect(physical());assert.equal(r.status,'physical-originals-documentary-only',r.reason);
 assert.equal(r.caseCount,18);assert.equal(r.accessibilityCount,7);assert.equal(r.physicalAccepted,0);
});
check('missing installed PWA original rejected',()=>{
 const x=physical();delete x.physical['installed-android-pwa:offline-launch'];
 assert.equal(A.inspect(x).status,'blocked-device-original');
});
check('changed browser version within physical platform refused',()=>{
 const x=physical();x.packet.cases[1].browserVersion='UNAUTHORIZED CHANGE';
 assert.equal(A.inspect(x).status,'blocked-device-original');
});
check('seven assistive originals source-byte tampering refused',()=>{
 const x=physical();x.assistive['screen-reader']=Buffer.from('altered');
 assert.equal(A.inspect(x).status,'blocked-assistive-original');
});
check('unchanged SW upgrade is not a different version',()=>{
 const x=physical();x.swBytes.update=x.swBytes.before;
 x.packet.sw.updateSha256=x.packet.sw.beforeSha256;
 assert.equal(A.inspect(x).status,'blocked-real-restore');
});
check('original immutable A9 cannot be misclassified as previous stable',()=>{
 const x=physical();x.packet.priorStable.sha256=P.a9NestedZipSha256;
 assert.equal(A.inspect(x).status,'blocked-real-restore');
});
check('conflicting physical witnesses remain disputed, not accepted',()=>{
 const x=[{platform:'android-chrome',caseId:'fresh-launch',originalSha256:a,witnessId:'A',status:'UNAPPROVED'},
  {platform:'android-chrome',caseId:'fresh-launch',originalSha256:b,witnessId:'B',status:'UNAPPROVED'}];
 const r=A.dispute({observations:x});assert.equal(r.status,'real-device-originals-conflicted');assert.equal(r.autoAccepted,false);
});
check('real owner staging cannot be cleared by incomplete external evidence',()=>{
 assert.equal(A.beforeRelease().status,'blocked-staging-evidence');
});
check('signed-looking documentary pre-release packet never authorizes cutover',()=>{
 const e=E.inspect(original()),i=I.reconcile(incident()),d=A.inspect(physical());
 const review={format:'GomokuA23PrecutoverOwnerReview',a22Head:P.a22Head,sourceSha:P.a9OriginalSha,
  realOwnerSigned:false,realReviewerSigned:false,physicalCasesApproved:0,
  a12Executed:false,hostedApproved:false,ownerOriginalSha256:a,reviewerOriginalSha256:b,
  escrowRoot:e.finalRoot};
 const r=A.beforeRelease({escrow:e,incident:i,device:d,review});
 assert.equal(r.status,'owner-precutover-documentary-only',r.reason);assert.equal(r.canDeploy,false);
});
check('A12 still unexecuted and real A13 0 hours; closure blocked',()=>{
 assert.equal(A.afterRelease().status,'blocked-postrelease-real');
});
check('all production, physical and human authority remain false',()=>{
 const r=A.status();assert.equal(r.physicalAccepted,0);assert.equal(r.realSignerKeys,0);
 for(const key of ['canMerge','canDeploy','canTag','canModifyProductionData','canCertifyPhysical','canCloseRelease','canGrantOwnerAuthority'])
 assert.equal(r[key],false);
});
console.log(total+' A23 adversarial byte-original, replay/compromise, physical/accessible, owner tests passed: ALL external signers/devices/hosts SYNTHETIC.');
