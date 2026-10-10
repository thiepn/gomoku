/* A25: REAL-ORIGINAL OFFLINE evidence handoff, not human/provider authentication.
 * Unifies separately supplied A24 field/host/rollback original-byte reviews and prevents
 * silent overwrite of previously recorded original-media/provider/restore SHA disputes.
 * No browser network, no credential, no production access, no signoff endpoint.
 */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const F=require('./a24-field-intake.cjs');
const H=require('./a24-offline-intake.cjs');
const A9=require('./a10-source-lock.json');
const SOURCE='a5ddd553386d4d5dfd9ad97bb432f47e2f8435af';
const DIGEST=/^[a-f0-9]{64}$/;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function error(message){throw new Error('A25 original handoff blocked: '+message)}
function review({fieldManifest,fieldRoot,hostManifest,hostRoot,a9OriginalRoot,
 rollbackManifest,rollbackRoot,previous,now=new Date()}={}){
 if(!fieldManifest||!fieldRoot)error('A24 field source manifest and original-media root required');
 const field=F.field({manifest:fieldManifest,root:fieldRoot,now});
 if(field.decision!=='NO_GO'||field.physicallyAcceptedBySoftware!==0||
    field.originalA9SourceSha!==A9.sourceSha)error('A24 physical source / acceptance mismatch');
 let host=null,rollback=null;
 if(Boolean(hostManifest)!==Boolean(hostRoot)||Boolean(hostManifest)!==Boolean(a9OriginalRoot))
  error('host manifest, original host bodies and immutable A9 originals must be supplied together');
 if(hostManifest){
  host=H.intake({manifest:hostManifest,captureRoot:hostRoot,originalRoot:a9OriginalRoot,now});
  if(host.decision!=='NO_GO'||host.originalHostedResponsesIndependentlyAuthenticated!==false||
     host.actualOriginalByteObjects!==8)error('A24 original host verification incomplete or misclassified');
 }
 if(Boolean(rollbackManifest)!==Boolean(rollbackRoot))
  error('distinct prior-stable manifest and SW originals must be supplied together');
 if(rollbackManifest){
  rollback=F.rollback({packet:rollbackManifest,root:rollbackRoot,now});
  if(rollback.decision!=='NO_GO'||rollback.playerStateRecoveryAccepted!==false)
    error('rollback source incorrectly treated as real recovery');
 }
 const evidence={
  field:field.records.map(x=>({id:x.id,sha256:x.sha256,category:x.category,
   reportedOS:x.reportedOS||null,reportedBrowser:x.reportedBrowser||null,
   status:x.status})).sort((a,b)=>a.id.localeCompare(b.id)),
  host:host?host.receipts.map(x=>({id:x.asset,sha256:x.sha256,category:'host',status:x.status}))
   .sort((a,b)=>a.id.localeCompare(b.id)):[],
  rollback:rollback?Object.entries(rollback.originalByteHashes)
   .map(([id,x])=>({id,sha256:x.sha256,category:'rollback',status:'PENDING_UNWITNESSED_RESTORE'}))
   .sort((a,b)=>a.id.localeCompare(b.id)):[]
 };
 const all=new Map();
 for(const [group,records] of Object.entries(evidence)){
  for(const x of records){
   if(!DIGEST.test(x.sha256)||all.has(group+':'+x.id))error('duplicate original evidence key or SHA');
   all.set(group+':'+x.id,x.sha256);
  }
 }
 const conflicts=[];
 if(previous!==undefined){
  if(previous?.format!=='GomokuA25OriginalEvidenceHandoff'||previous.version!==25||
     previous.a24QualifiedHead!==SOURCE||previous.originalA9SourceSha!==A9.sourceSha||
     previous.decision!=='NO_GO'||!previous.evidence||
     !Array.isArray(previous.evidence.field)||!Array.isArray(previous.evidence.host)||
     !Array.isArray(previous.evidence.rollback)||
     !DIGEST.test(previous.handoffDigest||'')||
     previous.handoffDigest!==hash(Buffer.from(JSON.stringify(previous.evidence))))
    error('prior handoff is untrusted or structurally tampered');
  for(const [group,records] of Object.entries(previous.evidence)){
   for(const record of records){
    const key=group+':'+record.id,next=all.get(key);
    if(next&&next!==record.sha256)
     conflicts.push({group,id:record.id,previousSha256:record.sha256,newSha256:next,
      status:'BLOCKED_INDEPENDENT_ORIGINAL_REVIEW'});
   }
  }
 }
 const checkList=[
  {gate:'A10 isolated hosted HTTPS',state:'OPEN',detail:host?
   'Eight ORIGINAL BYTES MATCHED A9; provider, server and owner original HTTP provenance still unverified.':
   'No original HTTP response files supplied to offline importer.'},
  {gate:'A11 physical 7+6+5',state:'OPEN',
   detail:field.pendingCaseCount+'/18 original file hashes captured, 0 human-accepted devices.'},
  {gate:'A11 accessibility',state:'OPEN',
   detail:field.pendingAssistiveCount+'/7 original media hashes captured, 0 human-accepted assistive cases.'},
  {gate:'A11 genuine same-origin service worker',state:'OPEN',
   detail:rollback?'Original before/update/revert SHA matched; no device/host SW change executed.':
     'No independent original before/update/revert bytes supplied.'},
  {gate:'Previous deployed stable and player-state restore',state:'OPEN',
   detail:rollback?'Offline previous-stable bytes differ from A9; no genuine deployed restoration.':
     'Distinct previous-deployed originals not supplied.'},
  {gate:'Independent provider/signer/global replay authority',state:'OPEN',
   detail:'No real trust roots, externally administered nonce provider or independent revocation acceptance.'},
  {gate:'Owner A11 physical, staging and A12 cutover',state:'OPEN',
   detail:'Original physical owner signoff and an actually executed separately approved A12 cutover missing.'},
  {gate:'A13 monitoring and postrelease closeout',state:'OPEN',
   detail:'No authentic 24–72h P20 production telemetry or later owner closure.'}
 ];
 return{format:'GomokuA25OriginalEvidenceHandoff',version:25,
  a24QualifiedHead:SOURCE,originalA9SourceSha:A9.sourceSha,
  originalSourceRunId:A9.githubRunId,
  classification:'OFFLINE_OPERATOR_SUPPLIED_BYTES_PENDING_EXTERNAL_HUMAN_AND_PROVIDER_REVIEW',
  evidence,handoffDigest:hash(Buffer.from(JSON.stringify(evidence))),
  coverage:{originalPhysicalPending:field.pendingCaseCount,
   originalAccessibilityPending:field.pendingAssistiveCount,actualPhysicalAccepted:0,
   missingCases:field.missingCases,missingAccessibility:field.missingAccessibility,
   originalHostedBytesVerifiedOffline:host?8:0,
   originalRollbackByteSetsReviewedOffline:rollback?1:0,
   independentlyAuthenticatedHostedOrigin:0,actualRestoredPlayerState:0},
  conflicts,manualResolutionRequired:conflicts.length>0,
  reviewChecklist:checkList,
  originalBinaryMediaIncluded:false,secretOrCredentialIncluded:false,
  realSignerRoots:0,actualPhysicalAccepted:0,ownerApproved:false,
  realCutoverPerformed:false,realA13Hours:0,canMerge:false,canTag:false,
  canDeploy:false,canModifyProductionData:false,canCertifyPhysical:false,
  canCloseRelease:false,canGrantOwnerAuthority:false,
  decision:'NO_GO',status:conflicts.length?'BLOCKED_ORIGINAL_CUSTODY_CONFLICT':'PENDING_EXTERNAL_EVIDENCE_REVIEW'};
}
function cli(args){
 const flags={};
 for(let i=0;i<args.length;i+=2){
  if(!args[i]?.startsWith('--')||!args[i+1]||flags[args[i]])error('named flags require unique values');
  flags[args[i]]=args[i+1];
 }
 if(!flags['--field-manifest']||!flags['--field-root']||!flags['--out'])
  error('usage: --field-manifest FILE --field-root DIRECTORY --out NEW_REPORT [--host-manifest/--host-root/--a9-root, --rollback-manifest/--rollback-root, --previous FILE]');
 const j=p=>p?JSON.parse(fs.readFileSync(p,'utf8')):undefined;
 const res=review({fieldManifest:j(flags['--field-manifest']),fieldRoot:flags['--field-root'],
  hostManifest:j(flags['--host-manifest']),hostRoot:flags['--host-root'],
  a9OriginalRoot:flags['--a9-root'],rollbackManifest:j(flags['--rollback-manifest']),
  rollbackRoot:flags['--rollback-root'],previous:j(flags['--previous'])});
 fs.writeFileSync(flags['--out'],JSON.stringify(res,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('A25 offline handoff: '+res.coverage.originalPhysicalPending+
 '/18 pending, '+res.coverage.originalAccessibilityPending+
 '/7 assistive, '+res.conflicts.length+' disputed originals; HUMAN/RELEASE NO_GO.');
}
module.exports={review,cli};
if(require.main===module){try{cli(process.argv.slice(2))}catch(e){console.error(String(e));process.exitCode=1}}
