import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';

const config=JSON.parse(fs.readFileSync('operations/p27-stable-release.json','utf8'));
const p26=JSON.parse(fs.readFileSync('operations/p26-release-candidate.json','utf8'));
const matrix=JSON.parse(fs.readFileSync('operations/p26-device-matrix.json','utf8'));
const command=process.argv[2]||'status';

const fail=message=>{throw new Error(message);};
const git=(args,opts={})=>execFileSync('git',args,{maxBuffer:16*1024*1024,...opts,stdio:['ignore','pipe','pipe']});
const ancestor=(older,newer='HEAD')=>spawnSync('git',['merge-base','--is-ancestor',older,newer]).status===0;

function validateContract(){
  if(config.version!=='p27.stable-release.v1')fail('Unsupported P27 contract version.');
  if(config.release_version!=='1.0.0'||config.release_tag!=='v1.0.0')fail('P27 is scoped only to Gomoku 1.0.0.');
  if(config.product_candidate_sha!==p26.candidate_source_sha)fail('P27 product candidate differs from P26.');
  if(config.p26_control_merge_sha!=='a522e2e3a8bab60db231b4d5ea3404b80c83d705')fail('Unexpected P26 control baseline.');
  if(!config.policy?.require_p26_release_ready||!config.policy?.require_exact_public_candidate)fail('P27 must inherit strict P26 release gates.');
  if(config.policy?.allow_automatic_release!==false)fail('P27 stable release must require explicit dispatch.');
  if(!config.policy?.maintenance_mode_after_release)fail('P27 must hand Gomoku to maintenance mode.');
  if(!ancestor(config.product_candidate_sha))fail('P27 product candidate is not an ancestor of HEAD.');
  if(!ancestor(config.p26_control_merge_sha))fail('P26 control merge is not an ancestor of HEAD.');
}

function readiness(){
  validateContract();
  const started=Date.parse(p26.started_at);
  const burnInEnds=started+p26.minimum_burn_in_hours*3600000;
  const required=matrix.profiles.filter(p=>p26.required_physical_profiles.includes(p.id));
  const pending=required.filter(p=>p.status!=='pass');
  const failed=matrix.profiles.filter(p=>p.status==='fail');
  const burnInComplete=Date.now()>=burnInEnds;
  return {
    version:'p27.readiness.v1',
    releaseTag:config.release_tag,
    productCandidate:config.product_candidate_sha,
    burnInEndsAt:new Date(burnInEnds).toISOString(),
    burnInComplete,
    requiredPhysicalProfiles:required.map(p=>({id:p.id,status:p.status})),
    pendingRequired:pending.map(p=>p.id),
    failures:failed.map(p=>p.id),
    p26ReleaseReady:burnInComplete&&pending.length===0&&failed.length===0,
    stableReleaseCreated:git(['tag','--list',config.release_tag],{encoding:'utf8'}).trim()===config.release_tag
  };
}

function runP26Strict(){
  const ready=spawnSync(process.execPath,['operations/p26-release-candidate.mjs','release-ready'],{stdio:'inherit'});
  if(ready.status!==0)fail('P26 release-ready gate has not passed.');
  const deployed=spawnSync(process.execPath,['operations/p26-release-candidate.mjs','deployed'],{stdio:'inherit'});
  if(deployed.status!==0)fail('P26 exact public candidate verification failed.');
}

function preflight(){
  validateContract();
  runP26Strict();
  const existing=git(['tag','--list',config.release_tag],{encoding:'utf8'}).trim();
  if(existing){
    const tagSha=git(['rev-list','-n','1',config.release_tag],{encoding:'utf8'}).trim();
    const headSha=git(['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    if(tagSha!==headSha)fail('Stable tag already exists at a different commit: '+config.release_tag+' -> '+tagSha);
  }
  const dirty=git(['status','--porcelain'],{encoding:'utf8'}).trim();
  if(dirty)fail('Release workspace must be clean.');
  return readiness();
}

function printStatus(status){
  console.log('### P27 stable-release status');
  console.log('');
  console.log('- Target: '+config.release_title+' ('+config.release_tag+')');
  console.log('- Product candidate: '+status.productCandidate);
  console.log('- P26 burn-in: '+(status.burnInComplete?'complete':'in progress')+'; ends '+status.burnInEndsAt);
  console.log('- Required physical profiles: '+status.requiredPhysicalProfiles.map(p=>p.id+'='+p.status).join(', '));
  console.log('- P26 release ready: **'+status.p26ReleaseReady+'**');
  console.log('- Stable tag already exists: **'+status.stableReleaseCreated+'**');
  console.log('');
  console.log(status.p26ReleaseReady
    ? 'P27 may be explicitly dispatched from main after the final current-main check.'
    : 'P27 is prepared but blocked. No stable tag or release may be created until P26 passes.');
}

if(command==='validate'){
  validateContract();
  console.log(JSON.stringify({ok:true,releaseTag:config.release_tag,productCandidate:config.product_candidate_sha},null,2));
}else if(command==='status'){
  printStatus(readiness());
}else if(command==='preflight'){
  const status=preflight();
  printStatus(status);
}else{
  fail('Usage: node operations/p27-stable-release.mjs <validate|status|preflight>');
}
