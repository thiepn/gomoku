import fs from 'node:fs';
import process from 'node:process';

const repo=process.env.GITHUB_REPOSITORY||'';
const sha=String(process.env.P16_CHECK_SHA||process.env.GITHUB_SHA||'').trim();
const token=process.env.GITHUB_TOKEN||'';
const required={
  p15_operations:'p15',
  p14_governance:'governance',
  p13_reliability:'p13',
  ranked:'ranked',
  lifecycle:'lifecycle',
  history:'history',
  profiles:'profiles',
  integrity:'integrity',
  p18_portability:'portable-preview'
};
const timeoutMs=Math.max(60_000,Number(process.env.P16_CHECK_TIMEOUT_MS)||12*60_000);
const pollMs=Math.max(5_000,Number(process.env.P16_CHECK_POLL_MS)||10_000);

if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('P16_CHECK_SHA must be an immutable commit SHA.');
if(!/^[^/]+\/[^/]+$/.test(repo))throw new Error('GITHUB_REPOSITORY is invalid.');
if(!token)throw new Error('GITHUB_TOKEN is required to read authoritative check runs.');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function checkRuns(){
  const res=await fetch('https://api.github.com/repos/'+repo+'/commits/'+sha+'/check-runs?per_page=100',{
    headers:{
      Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'gomoku-p16-release-control'
    }
  });
  if(!res.ok)throw new Error('GitHub check-runs request failed: '+res.status+' '+await res.text());
  const data=await res.json();
  return Array.isArray(data.check_runs)?data.check_runs:[];
}
function latestByName(runs,name){
  return runs.filter(x=>x?.name===name).sort((a,b)=>new Date(b.completed_at||b.started_at||0)-new Date(a.completed_at||a.started_at||0))[0]||null;
}

const deadline=Date.now()+timeoutMs;
let finalEvidence=null;
while(Date.now()<deadline){
  const runs=await checkRuns(),evidence={},pending=[],failed=[];
  for(const [policyName,checkName] of Object.entries(required)){
    const run=latestByName(runs,checkName);
    if(!run){
      pending.push(checkName);
      evidence[policyName]={status:'pending',checkName};
      continue;
    }
    const item={
      status:run.status==='completed'&&run.conclusion==='success'?'passed':run.status==='completed'?'failed':'pending',
      checkName,
      checkRunId:run.id,
      conclusion:run.conclusion||null,
      detailsUrl:run.html_url||null,
      startedAt:run.started_at||null,
      completedAt:run.completed_at||null
    };
    evidence[policyName]=item;
    if(item.status==='pending')pending.push(checkName);
    if(item.status==='failed')failed.push(checkName+':'+String(run.conclusion||'unknown'));
  }
  if(failed.length){
    fs.writeFileSync('/tmp/p16-check-evidence.json',JSON.stringify(evidence,null,2));
    throw new Error('Authoritative release checks failed: '+failed.join(', '));
  }
  if(!pending.length){finalEvidence=evidence;break;}
  console.log('Waiting for authoritative checks: '+pending.join(', '));
  await sleep(pollMs);
}
if(!finalEvidence)throw new Error('Timed out waiting for authoritative release checks.');

fs.writeFileSync('/tmp/p16-check-evidence.json',JSON.stringify(finalEvidence,null,2));
console.log('PASS P16 authoritative check evidence: '+Object.keys(finalEvidence).join(', '));
