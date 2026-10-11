/* A27: offline, one-at-a-time OPERATOR observations; never human/device certification. */
'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const {DEVICE_CHECKS}=require('./release-gate.js');
const {ACCESS}=require('./a21-hardware.cjs');
const {readUnder}=require('./a24-offline-intake.cjs');
const PIN=require('./a10-source-lock.json');
const A26_HEAD='407bfb88430539932ab6bf07df1b33ae7b86829c';
const CASES=Object.freeze([
 ...Object.entries(DEVICE_CHECKS).flatMap(([group,ids])=>ids.map(id=>group+':'+id)),
 ...ACCESS.map(id=>'accessibility:'+id)
]);
const SHA=/^[a-f0-9]{64}$/;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function stop(s){throw Error('A27 FIELD NO_GO: '+s)}
function shape(v,keys){
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
}
function text(v,min=1,max=2048){return typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000-\u001f\u007f]/.test(v)}
function time(t,now){
 if(typeof t!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(t)||!
  Number.isFinite(Date.parse(t))||new Date(t).toISOString()!==t||
  Date.parse(t)>now.getTime()||Date.parse(t)<Date.parse('2020-01-01T00:00:00Z'))
  stop('invalid/future real-world observation time');
}
function preview(input){
 let u;try{u=new URL(input)}catch{stop('invalid manually observed HTTPS origin')}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||
    u.origin+'/'!==input||!u.hostname.includes('.')||
    !/^[a-z0-9.-]+$/.test(u.hostname)||
    /(^|\.)localhost$/.test(u.hostname)||/^\d+(\.\d+){3}$/.test(u.hostname)||
    u.hostname==='thiepn.dev'||u.hostname.endsWith('.thiepn.dev'))
   stop('only explicitly isolated, manually authorized HTTPS preview origins; never production');
 return input; // Not proof of authorization or a network request.
}
function fullStatus(records){
 const map=new Map(records.map(x=>[x.id,x]));
 return CASES.map((id,index)=>({id,position:index+1,
  status:map.get(id)?.reportedStatus||'NOT_TESTED',
  evidence:map.get(id)?.evidenceStatus||'NONE',
  independentHumanApproved:false}));
}
function evaluate({manifest,receipt,mediaRoot,rightsRoot,witnessRoot,now=new Date()}={}){
 if(!shape(manifest,['format','version','a26QualifiedHead','originalA9SourceSha','releaseState',
   'humanOwnerApproval','observations'])||
   manifest.format!=='GomokuA27PhysicalObservationDraft'||manifest.version!==27||
   manifest.a26QualifiedHead!==A26_HEAD||manifest.originalA9SourceSha!==PIN.sourceSha||
   manifest.releaseState!=='NO_GO'||manifest.humanOwnerApproval!=='NOT_OBTAINED'||
   !Array.isArray(manifest.observations)||manifest.observations.length>25)
  stop('draft identity/authority shape invalid');
 if(!CASES.length||CASES.length!==25)stop('25 immutable A11 cases expected');
 let a26=null;
 if(receipt!==undefined){
  if(!shape(receipt,['format','version','sourceHead','a25HandoffDigest','originalA9SourceSha',
     'sourceFileIntegrityOnly','originalMediaIncluded','personalObservationsExported',
     'candidateRecords','pendingWitnessOriginalCount','missingPhysicalCases',
     'missingAccessibility','actualPhysicalAccepted','actualAccessibilityAccepted',
     'genuineHostedOriginAuthenticated','independentHumanIdentityVerified',
     'consentAndSourceRightsApproved','realSignerRoots','globalReplayAccepted',
     'realServiceWorkerUpdate','realPlayerStateRecovery','ownerApproved',
     'realCutoverPerformed','realA13Hours','canMerge','canTag','canDeploy',
     'canModifyProductionData','canCertifyPhysical','canCloseRelease',
     'canGrantOwnerAuthority','releaseGates','decision','status'])||
     receipt.format!=='GomokuA26UnverifiedOriginalWitnessHandoff'||receipt.version!==26||
     receipt.sourceHead!==A26_HEAD||receipt.originalA9SourceSha!==PIN.sourceSha||
     receipt.decision!=='NO_GO'||receipt.ownerApproved!==false||
     receipt.actualPhysicalAccepted!==0||receipt.actualAccessibilityAccepted!==0||
     receipt.independentHumanIdentityVerified!==false||receipt.canDeploy!==false||
     !Array.isArray(receipt.candidateRecords))
    stop('untrusted A26 pending-only receipt');
  a26=new Map();
  for(const row of receipt.candidateRecords){
   if(!text(row.id)||!CASES.includes(row.id)||a26.has(row.id)||
     !SHA.test(row.sourceMediaSha256||'')||!SHA.test(row.sourceRightsSha256||'')||
     !SHA.test(row.originalWitnessSha256||''))
    stop('invalid duplicate A26 source case');
   a26.set(row.id,row);
  }
 }
 const seen=new Set(),results=[],problems=[];
 for(const row of manifest.observations){
  if(!shape(row,['id','reportedStatus','testedOrigin','deviceModel',
    'osVersion','browserVersion','operatorAlias','observedAt','observation',
    'originalMediaSha256','originalRightsSha256','originalWitnessSha256'])||
    !CASES.includes(row.id)||seen.has(row.id)||!
    ['PASS','FAIL'].includes(row.reportedStatus))
    stop('unknown/duplicate case or unrecognized observation status');
  seen.add(row.id);
  preview(row.testedOrigin);
  time(row.observedAt,now);
  for(const k of ['deviceModel','osVersion','browserVersion','operatorAlias'])
   if(!text(row[k],3,120))stop('missing physical operator/device detail');
  if(!text(row.observation,24,2000))stop('actual observation required; do not submit hypothetical test');
  const recorded={id:row.id,reportedStatus:row.reportedStatus,
   testedOrigin:row.testedOrigin,
   observedAt:row.observedAt,
   evidenceStatus:'NOT_REQUALIFIED',independentHumanApproved:false};
  const originalKeys=['originalMediaSha256','originalRightsSha256','originalWitnessSha256'];
  const hasAll=originalKeys.every(k=>SHA.test(row[k]||''));
  const hasNone=originalKeys.every(k=>row[k]===null);
  if(!hasAll&&!hasNone)stop('partial source evidence is not allowed');
  if(row.reportedStatus==='PASS'&&!hasAll)
   stop('reported PASS cannot omit all three preserved original source receipts');
  if(hasAll){
   if(!a26||!mediaRoot||!rightsRoot||!witnessRoot)stop('all original roots and A26 receipt needed to requalify three original files');
   const past=a26.get(row.id);
   if(!past||past.sourceMediaSha256!==row.originalMediaSha256||
     past.sourceRightsSha256!==row.originalRightsSha256||
     past.originalWitnessSha256!==row.originalWitnessSha256)
     stop('A26 matched-original receipt missing or altered for '+row.id);
   const [group,caseId]=row.id.split(':');
   const originalPath=group==='accessibility'?'assistive/'+caseId+'.bin':
    'media/'+group+'/'+caseId+'.bin';
   const paths=[[mediaRoot,originalPath,'originalMediaSha256'],
    [rightsRoot,'rights/'+group+'/'+caseId+'.bin','originalRightsSha256'],
    [witnessRoot,'witness/'+group+'/'+caseId+'.bin','originalWitnessSha256']];
   for(const [root,relative,key] of paths){
    let bytes;try{bytes=readUnder(root,relative)}
    catch(e){stop('unsafe/missing original for '+row.id+': '+e.message)}
    if(hash(bytes)!==row[key])stop('original byte conflict for '+row.id+' / '+key);
   }
   recorded.evidenceStatus='THREE_LOCAL_BYTE_HASHES_MATCH_NOT_HUMAN_AUTHENTICATED';
  }else{
   recorded.evidenceStatus='MISSING_ORIGINALS_FAIL_REQUIRES_TRIAGE';
   problems.push({id:row.id,type:'MISSING_ORIGINALS',status:'OPEN'});
  }
  if(row.reportedStatus==='FAIL')
   problems.push({id:row.id,type:'REPORTED_DEFECT_REQUIRES_REPRODUCTION',status:'OPEN'});
  results.push(recorded);
 }
 const states=fullStatus(results);
 const count=s=>states.filter(x=>x.status===s).length;
 return {format:'GomokuA27PendingOperatorObservations',version:27,
  parentA26:A26_HEAD,originalA9SourceSha:PIN.sourceSha,
  reportedPass:count('PASS'),reportedFail:count('FAIL'),
  notTested:count('NOT_TESTED'),totalCases:CASES.length,
  physicalHumanAccepted:0,accessibilityHumanAccepted:0,
  operatorReportedOnly:true,
  originalBinaryIncluded:false,privateObservationNotesExported:false,
  sourceProvenanceAuthenticated:false,hostOwnerAuthorizationAuthenticated:false,
  observedResults:results,caseStates:states,
  openReproductionIssues:problems,
  pendingHostedOriginResponses:8,independentWitnessesApproved:0,
  actualServiceWorkerRestore:false,actualPlayerStateRestore:false,
  ownerReleaseApproval:false,actualA12Cutover:false,actualA13Hours:0,
  canMerge:false,canTag:false,canDeploy:false,canModifyProductionData:false,
  canCertifyPhysical:false,canCloseRelease:false,decision:'NO_GO'};
}
function cli(argv){
 const flags={},allowed=new Set(['--observations','--a26','--media-root','--rights-root','--witness-root','--out']);
 if(argv.length%2)stop('named argument values required');
 for(let i=0;i<argv.length;i+=2){
  if(!allowed.has(argv[i])||flags[argv[i]]||!argv[i+1])stop('unknown/duplicate flag');
  flags[argv[i]]=argv[i+1];
 }
 if(!flags['--observations']||!flags['--out'])stop('usage: --observations FILE --out NEW_FILE [--a26 FILE --media-root DIR --rights-root DIR --witness-root DIR]');
 const originalFlags=['--a26','--media-root','--rights-root','--witness-root'];
 if(originalFlags.filter(k=>flags[k]).length!==0&&originalFlags.filter(k=>flags[k]).length!==4)
   stop('all A26/original root arguments must be supplied together');
 const read=k=>{
  if(!flags[k])return undefined;
  if(fs.statSync(flags[k]).size>1024*1024)stop('manifest exceeds 1 MiB');
  return JSON.parse(fs.readFileSync(flags[k],'utf8'));
 };
 const out=evaluate({manifest:read('--observations'),receipt:read('--a26'),
   mediaRoot:flags['--media-root'],rightsRoot:flags['--rights-root'],
   witnessRoot:flags['--witness-root']});
 fs.writeFileSync(flags['--out'],JSON.stringify(out,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('A27 local observations PASS='+out.reportedPass+' FAIL='+out.reportedFail+
  ' NOT_TESTED='+out.notTested+'; HUMAN/RELEASE NO_GO');
}
module.exports={CASES,evaluate,cli,preview};
if(require.main===module){try{cli(process.argv.slice(2))}
 catch(e){console.error(String(e));process.exitCode=1}}
