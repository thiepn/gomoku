import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';

const config=JSON.parse(fs.readFileSync('operations/p26-release-candidate.json','utf8'));
const matrix=JSON.parse(fs.readFileSync('operations/p26-device-matrix.json','utf8'));
const command=process.argv[2]||'status';

const fail=message=>{throw new Error(message);};
const sha256=data=>createHash('sha256').update(data).digest('hex');
const git=(args,opts={})=>execFileSync('git',args,{...opts,stdio:['ignore','pipe','pipe']});
const show=(sha,path)=>git(['show',sha+':'+path]);
const allowedStatuses=new Set(['pending_manual','pass','fail','blocked']);
const candidate=config.candidate_source_sha;

function isAllowedPath(path){
  return config.allowed_p26_paths.some(rule=>rule.endsWith('/**')?path.startsWith(rule.slice(0,-3)):path===rule);
}

function candidateDiff(){
  const ancestor=spawnSync('git',['merge-base','--is-ancestor',candidate,'HEAD']);
  if(ancestor.status!==0)fail('P26 candidate is not an ancestor of HEAD: '+candidate);
  const output=git(['diff','--name-only',candidate+'..HEAD'],{encoding:'utf8'}).trim();
  return output?output.split(/\r?\n/).filter(Boolean):[];
}

function validateMatrix(){
  if(matrix.candidate_source_sha!==candidate)fail('Device matrix candidate SHA differs from P26 candidate.');
  const ids=new Set();
  for(const profile of matrix.profiles){
    if(!profile.id||ids.has(profile.id))fail('Duplicate or missing P26 profile id: '+String(profile.id));
    ids.add(profile.id);
    if(!allowedStatuses.has(profile.status))fail('Unsupported P26 device status for '+profile.id+': '+profile.status);
    if(!Array.isArray(profile.checks)||!profile.checks.length)fail('P26 device profile has no checks: '+profile.id);
    if(profile.status==='pass'){
      for(const field of ['tested_at','device','os_version','browser','browser_version']){
        if(!profile.evidence?.[field])fail('Passed P26 profile '+profile.id+' lacks manual evidence field '+field);
      }
    }
    if(profile.status==='fail'&&!profile.evidence?.notes)fail('Failed P26 profile '+profile.id+' must explain the reproduced defect.');
  }
  for(const id of config.required_physical_profiles)if(!ids.has(id))fail('Missing required P26 physical profile '+id);
}

function validateCandidate(){
  if(!/^[0-9a-f]{40}$/.test(candidate))fail('P26 candidate SHA must be immutable.');
  if(!Number.isFinite(config.minimum_burn_in_hours)||config.minimum_burn_in_hours<12)fail('P26 burn-in must be at least 12 hours.');
  const started=Date.parse(config.started_at);
  if(!Number.isFinite(started))fail('Invalid P26 burn-in start.');
  validateMatrix();
  const changed=candidateDiff();
  const forbidden=changed.filter(path=>!isAllowedPath(path));
  if(forbidden.length)fail('P26 candidate invalidated by non-P26 changes: '+forbidden.join(', '));
  for(const path of config.immutable_artifacts){
    const baseline=show(candidate,path);
    const current=fs.readFileSync(path);
    if(sha256(baseline)!==sha256(current))fail('Immutable P26 artifact changed: '+path);
  }
  return {changed,started};
}

async function verifyDeployed(){
  validateCandidate();
  const base=String(config.public_base_url).replace(/\/?$/,'/');
  const artifacts={};
  for(const path of config.immutable_artifacts){
    const expected=show(candidate,path);
    const url=base+path+'?p26='+Date.now();
    const response=await fetch(url,{headers:{'cache-control':'no-cache'}});
    if(!response.ok)fail('P26 deployment fetch failed for '+path+': '+response.status);
    const actual=Buffer.from(await response.arrayBuffer());
    const expectedHash=sha256(expected);
    const actualHash=sha256(actual);
    artifacts[path]={expectedHash,actualHash,bytes:actual.length,match:expectedHash===actualHash};
    if(expectedHash!==actualHash)fail('P26 deployed artifact differs from candidate: '+path);
  }
  return artifacts;
}

function readiness(){
  const {started}=validateCandidate();
  const now=Date.now();
  const burnInEnds=started+config.minimum_burn_in_hours*3600000;
  const required=matrix.profiles.filter(p=>config.required_physical_profiles.includes(p.id));
  const failed=matrix.profiles.filter(p=>p.status==='fail');
  const blocked=required.filter(p=>p.status==='blocked');
  const pending=required.filter(p=>p.status!=='pass');
  const releaseReady=now>=burnInEnds&&failed.length===0&&blocked.length===0&&pending.length===0;
  return {
    version:'p26.readiness.v1',
    candidate,
    startedAt:new Date(started).toISOString(),
    minimumBurnInHours:config.minimum_burn_in_hours,
    burnInEndsAt:new Date(burnInEnds).toISOString(),
    burnInComplete:now>=burnInEnds,
    requiredPhysicalProfiles:required.map(p=>({id:p.id,status:p.status})),
    recommendedPhysicalProfiles:matrix.profiles.filter(p=>config.recommended_physical_profiles.includes(p.id)).map(p=>({id:p.id,status:p.status})),
    failures:failed.map(p=>p.id),
    pendingRequired:pending.map(p=>p.id),
    releaseReady
  };
}

function printSummary(status,deployed=null){
  console.log('### P26 release-candidate status');
  console.log('');
  console.log('- Candidate: '+status.candidate);
  console.log('- Burn-in: '+(status.burnInComplete?'complete':'in progress')+' (minimum '+status.minimumBurnInHours+'h; ends '+status.burnInEndsAt+')');
  console.log('- Required physical profiles: '+status.requiredPhysicalProfiles.map(p=>p.id+'='+p.status).join(', '));
  console.log('- Release ready: **'+status.releaseReady+'**');
  if(deployed)console.log('- Deployed immutable artifacts: '+Object.entries(deployed).map(([k,v])=>k+'='+(v.match?'match':'mismatch')).join(', '));
  console.log('');
  console.log('P26 does not infer physical-device success from emulation. Manual evidence is required before P27.');
}

if(command==='validate'){
  const result=validateCandidate();
  console.log(JSON.stringify({ok:true,candidate,allowedChanges:result.changed},null,2));
}else if(command==='deployed'){
  const result=await verifyDeployed();
  console.log(JSON.stringify({ok:true,candidate,artifacts:result},null,2));
}else if(command==='status'){
  printSummary(readiness());
}else if(command==='release-ready'){
  const status=readiness();
  printSummary(status);
  if(!status.releaseReady)process.exitCode=2;
}else if(command==='deployed-status'){
  const deployed=await verifyDeployed();
  printSummary(readiness(),deployed);
}else{
  fail('Usage: node operations/p26-release-candidate.mjs <validate|deployed|status|release-ready|deployed-status>');
}
