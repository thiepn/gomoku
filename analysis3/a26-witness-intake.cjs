/* A26: Offline, original-byte witness candidate intake. Never grants human/provider authority. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const A25=require('./a25-handoff.cjs');
const H=require('./a24-offline-intake.cjs');
const A9=require('./a10-source-lock.json');
const SOURCE='10670c85fbd18077069ad69dc8a8079e0214127f';
const A24='a5ddd553386d4d5dfd9ad97bb432f47e2f8435af';
const SHA=/^[a-f0-9]{64}$/;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fail(message){throw Error('A26 PENDING WITNESS BLOCKED: '+message)}
function exact(obj,keys){
 return obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&
  Object.keys(obj).sort().join('|')===keys.slice().sort().join('|');
}
function safeText(t,min,max){
 return typeof t==='string'&&t.trim().length>=min&&t.length<=max&&
  !/[\u0000-\u001f\u007f]/.test(t);
}
function validateA25(packet,actual){
 if(packet?.format!=='GomokuA25OriginalEvidenceHandoff'||packet.version!==25||
   packet.decision!=='NO_GO'||packet.ownerApproved!==false||packet.canDeploy!==false||
   packet.canMerge!==false||packet.actualPhysicalAccepted!==0||
   packet.a24QualifiedHead!==A24||packet.originalA9SourceSha!==A9.sourceSha||
   !packet.evidence||!SHA.test(packet.handoffDigest||'')||
   packet.handoffDigest!==sha(Buffer.from(JSON.stringify(packet.evidence)))||
   packet.handoffDigest!==actual.handoffDigest||
   JSON.stringify(packet.evidence)!==JSON.stringify(actual.evidence))
  fail('A25 handoff fails exact original-byte source requalification (digest alone is NOT authentication)');
 if(packet.manualResolutionRequired||packet.conflicts?.length||actual.manualResolutionRequired)
  fail('unresolved original custody conflicts require independent adjudication first');
}
function review({a25Handoff,fieldManifest,fieldRoot,rightsRoot,witnessManifest,witnessRoot,
 hostManifest,hostRoot,a9Root,rollbackManifest,rollbackRoot,now=new Date()}={}){
 if(!a25Handoff||!fieldManifest||!fieldRoot||!rightsRoot||!witnessManifest||!witnessRoot)
  fail('A25 handoff, A24 field manifest, original media/rights and witness source root required');
 const rebuilt=A25.review({fieldManifest,fieldRoot,rightsRoot,hostManifest,hostRoot,
  a9OriginalRoot:a9Root,rollbackManifest,rollbackRoot,now});
 validateA25(a25Handoff,rebuilt);
 const m=witnessManifest;
 if(!exact(m,['format','version','sourceHead','a25HandoffDigest','state','ownerApproval',
  'releaseState','humanVerifiedCount','entries'])||
  m.format!=='GomokuA26WitnessCandidate'||m.version!==26||
  m.sourceHead!==SOURCE||m.a25HandoffDigest!==rebuilt.handoffDigest||
  m.state!=='PENDING_INDEPENDENT_AUTHENTICATION'||m.ownerApproval!=='NOT_OBTAINED'||
  m.releaseState!=='NO_GO'||m.humanVerifiedCount!==0||
  !Array.isArray(m.entries)||m.entries.length<1||m.entries.length>25)
  fail('invalid candidate manifest or attempted release/physical authority assertion');
 const field=new Map(rebuilt.evidence.field.map(x=>[x.id,x]));
 const rights=new Map(rebuilt.evidence.rights.map(x=>[x.id,x]));
 const seen=new Set(),usedWitness=new Set(),receipts=[];
 for(const r of m.entries){
  if(!exact(r,['group','id','mediaSha256','rightsSha256','witnessOriginalSha256',
   'witnessFile','claimedWitnessAlias','observation','observedAt','state'])||
   r.group!=='field'||typeof r.id!=='string'||seen.has(r.id)||
   !field.has(r.id)||!rights.has(r.id)||
   r.mediaSha256!==field.get(r.id).sha256||r.rightsSha256!==rights.get(r.id).sha256||
   !SHA.test(r.witnessOriginalSha256||'')||r.witnessOriginalSha256===r.mediaSha256||
   r.witnessOriginalSha256===r.rightsSha256||
   r.state!=='PENDING_INDEPENDENT_AUTHENTICATION'||
   !safeText(r.claimedWitnessAlias,3,100)||!safeText(r.observation,24,2000))
   fail('unknown/duplicate case, invalid witness data or media/rights mismatch');
  const parts=r.id.split(':');
  if(parts.length!==2||!(/^(android-chrome|samsung-internet|installed-android-pwa|accessibility)$/).test(parts[0])||
    !/^[a-z0-9-]+$/.test(parts[1]))
   fail('witness case path is not an allowed physical/accessibility identity');
  const expected='witness/'+parts[0]+'/'+parts[1]+'.bin';
  if(r.witnessFile!==expected)fail('witness path must be the canonical private-custody relative path');
  const date=new Date(r.observedAt);
  if(typeof r.observedAt!=='string'||Number.isNaN(date.getTime())||
    date.toISOString()!==r.observedAt||date>now||date.getUTCFullYear()<2020)
   fail('invalid or future self-reported witness timestamp');
  let b;try{b=H.readUnder(witnessRoot,expected,{max:10*1024*1024})}
  catch(e){fail('missing, unsafe or oversized original witness '+r.id+': '+e.message)}
  if(!b.length||sha(b)!==r.witnessOriginalSha256)
   fail('witness original file byte hash mismatch: '+r.id);
  if(usedWitness.has(r.witnessOriginalSha256))fail('same original witness file reused across cases');
  seen.add(r.id);usedWitness.add(r.witnessOriginalSha256);
  receipts.push({id:r.id,sourceMediaSha256:r.mediaSha256,
   sourceRightsSha256:r.rightsSha256,originalWitnessSha256:r.witnessOriginalSha256,
   originalWitnessBytes:b.length,claimedWitnessAliasSha256:sha(Buffer.from(r.claimedWitnessAlias)),
   status:'BYTES_MATCHED_PENDING_EXTERNAL_IDENTITY_RIGHTS_AND_OBSERVATION_REVIEW'});
 }
 receipts.sort((a,b)=>a.id.localeCompare(b.id));
 return {format:'GomokuA26UnverifiedOriginalWitnessHandoff',version:26,
  sourceHead:SOURCE,a25HandoffDigest:rebuilt.handoffDigest,originalA9SourceSha:A9.sourceSha,
  sourceFileIntegrityOnly:true,originalMediaIncluded:false,personalObservationsExported:false,
  candidateRecords:receipts,pendingWitnessOriginalCount:receipts.length,
  missingPhysicalCases:rebuilt.coverage.missingCases,
  missingAccessibility:rebuilt.coverage.missingAccessibility,
  actualPhysicalAccepted:0,actualAccessibilityAccepted:0,
  genuineHostedOriginAuthenticated:false,independentHumanIdentityVerified:false,
  consentAndSourceRightsApproved:false,realSignerRoots:0,globalReplayAccepted:false,
  realServiceWorkerUpdate:false,realPlayerStateRecovery:false,
  ownerApproved:false,realCutoverPerformed:false,realA13Hours:0,
  canMerge:false,canTag:false,canDeploy:false,canModifyProductionData:false,
  canCertifyPhysical:false,canCloseRelease:false,canGrantOwnerAuthority:false,
  releaseGates:['A10 genuine hosted HTTPS witness','A11 18 physical + 7 accessibility originals with authorized external humans',
   'Actual same-origin PWA/SW and previous stable player-state restoration',
   'Authentic provider/source rights, independent signer and global replay/revocation',
   'Owner A11 signoff and separately authorized executed A12 cutover',
   'Authentic A13 24–72h telemetry and final owner closure'],
  decision:'NO_GO',status:'PENDING_INDEPENDENT_HUMAN_AND_ORIGINAL_SOURCE_AUTHENTICATION'};
}
function cli(args){
 const known=new Set(['--a25','--field-manifest','--field-root','--rights-root',
  '--witness-manifest','--witness-root','--host-manifest','--host-root','--a9-root',
  '--rollback-manifest','--rollback-root','--out']);
 const flags={};
 if(args.length%2)fail('unique named arguments required');
 for(let i=0;i<args.length;i+=2){
  if(!known.has(args[i])||flags[args[i]]||!args[i+1])fail('unknown or duplicate flag');
  flags[args[i]]=args[i+1];
 }
 for(const k of ['--a25','--field-manifest','--field-root','--rights-root',
  '--witness-manifest','--witness-root','--out'])
  if(!flags[k])fail('required argument absent: '+k);
 const read=k=>{
  if(!flags[k])return undefined;
  if(fs.statSync(flags[k]).size>1024*1024)fail('manifest file size limit exceeded');
  return JSON.parse(fs.readFileSync(flags[k],'utf8'));
 };
 const result=review({a25Handoff:read('--a25'),fieldManifest:read('--field-manifest'),
  fieldRoot:flags['--field-root'],rightsRoot:flags['--rights-root'],
  witnessManifest:read('--witness-manifest'),witnessRoot:flags['--witness-root'],
  hostManifest:read('--host-manifest'),hostRoot:flags['--host-root'],a9Root:flags['--a9-root'],
  rollbackManifest:read('--rollback-manifest'),rollbackRoot:flags['--rollback-root']});
 fs.writeFileSync(flags['--out'],JSON.stringify(result,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log('A26 verified '+result.pendingWitnessOriginalCount+
  ' witness source-file digests. Human/device/rights/provider approval remains NO_GO.');
}
module.exports={review,cli};
if(require.main===module){try{cli(process.argv.slice(2))}
 catch(e){console.error(String(e));process.exitCode=1}}
