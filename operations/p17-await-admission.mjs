import process from 'node:process';

const repo=process.env.GITHUB_REPOSITORY||'';
const sha=String(process.env.P17_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
const token=process.env.GITHUB_TOKEN||'';
const timeoutMs=Math.max(60_000,Number(process.env.P17_ADMISSION_TIMEOUT_MS)||15*60_000);
const pollMs=Math.max(5_000,Number(process.env.P17_ADMISSION_POLL_MS)||10_000);

if(!/^[0-9a-f]{40}$/.test(sha))throw new Error('P17_GIT_SHA must be an immutable 40-character Git SHA.');
if(!/^[^/]+\/[^/]+$/.test(repo))throw new Error('GITHUB_REPOSITORY is invalid.');
if(!token)throw new Error('GITHUB_TOKEN is required to verify P16 admission.');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function runs(){
  const res=await fetch('https://api.github.com/repos/'+repo+'/commits/'+sha+'/check-runs?per_page=100',{
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'gomoku-p17-preview-promotion'}
  });
  if(!res.ok)throw new Error('GitHub check-runs request failed: '+res.status+' '+await res.text());
  const data=await res.json();
  return Array.isArray(data.check_runs)?data.check_runs:[];
}
const deadline=Date.now()+timeoutMs;
while(Date.now()<deadline){
  const all=await runs();
  const q=all.filter(x=>x?.name==='qualify').sort((a,b)=>new Date(b.started_at||0)-new Date(a.started_at||0))[0];
  if(q?.status==='completed'){
    if(q.conclusion==='success'){
      console.log('PASS P17: P16 admission qualifier succeeded for '+sha+' via '+q.html_url);
      process.exit(0);
    }
    throw new Error('P16 admission qualifier did not succeed: '+String(q.conclusion||'unknown')+' '+String(q.html_url||''));
  }
  console.log('Waiting for P16 qualification/admission on '+sha+'…');
  await sleep(pollMs);
}
throw new Error('Timed out waiting for P16 qualification/admission.');
