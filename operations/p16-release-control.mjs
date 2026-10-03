import process from 'node:process';

const BASE='https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const AUDIENCE='gomoku-production-control';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function oidcToken(){
  const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!url||!bearer)throw new Error('GitHub OIDC environment is unavailable. Ensure id-token: write permission.');
  const join=url.includes('?')?'&':'?';
  const res=await fetch(url+join+'audience='+encodeURIComponent(AUDIENCE),{
    headers:{Authorization:'Bearer '+bearer,Accept:'application/json'}
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.value)throw new Error('Could not obtain GitHub OIDC token: '+res.status);
  return data.value;
}

async function automation(path,body,{attempts=12}={}){
  let last;
  for(let i=0;i<attempts;i++){
    const token=await oidcToken();
    const res=await fetch(BASE+'/api/automation/'+path,{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await res.json().catch(()=>({}));
    if(res.ok)return data;
    last=new Error((data&&data.error)||('Automation request failed: '+res.status));
    last.status=res.status;
    if(![404,502,503].includes(res.status)||i===attempts-1)throw last;
    await sleep(5000);
  }
  throw last||new Error('Automation request failed.');
}

async function health({attempts=12}={}){
  let last;
  for(let i=0;i<attempts;i++){
    const res=await fetch(BASE+'/api/health',{cache:'no-store'});
    const data=await res.json().catch(()=>({}));
    if(res.ok)return data;
    last=new Error((data&&data.error)||('Health request failed: '+res.status));
    if(![404,502,503].includes(res.status)||i===attempts-1)throw last;
    await sleep(5000);
  }
  throw last||new Error('Health request failed.');
}

function gitSha(){
  const v=String(process.env.P16_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(v))throw new Error('P16_GIT_SHA must be a 40-character Git SHA.');
  return v;
}

function passed(label){
  return {status:'passed',label,runId:process.env.GITHUB_RUN_ID||null,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)||1};
}

async function main(){
  const mode=String(process.argv[2]||'').toLowerCase();

  if(mode==='admit'){
    const sha=gitSha();
    let external={};
    const evidenceFile=String(process.env.P16_EVIDENCE_FILE||'').trim();
    if(evidenceFile){
      try{external=JSON.parse((await import('node:fs')).readFileSync(evidenceFile,'utf8'));}catch(error){throw new Error('Could not read P16 authoritative evidence: '+error.message);}
    }
    const checks={
      p16_contract:passed('P16 release-control contracts'),
      ...external
    };
    for(const name of ['p15_operations','p14_governance','p13_reliability','ranked','lifecycle','history','profiles','integrity','p18_portability','p19_supply_chain','p20_slo_governance','p21_capacity']){
      if(checks[name]?.status!=='passed')throw new Error('Authoritative admission evidence is missing or failed: '+name);
    }
    const out=await automation('admission',{gitSha:sha,checks,workflowAttempt:Number(process.env.GITHUB_RUN_ATTEMPT)||1});
    console.log(JSON.stringify(out,null,2));
    if(out?.admission?.decision!=='admitted')throw new Error('Release admission was not granted.');
    return;
  }

  if(mode==='event'){
    const sha=gitSha(),stage=String(process.env.P16_STAGE||''),status=String(process.env.P16_STATUS||'');
    let details={};
    try{details=JSON.parse(process.env.P16_DETAILS_JSON||'{}');}catch{throw new Error('P16_DETAILS_JSON must be valid JSON.');}
    const out=await automation('orchestration',{gitSha:sha,stage,status,details});
    console.log(JSON.stringify(out,null,2));
    return;
  }

  if(mode==='deployment'){
    const sha=gitSha(),live=await health();
    if(live?.phase!=='P16')throw new Error('Production is not serving P16 after deployment.');
    if(live?.build?.gitSha!==sha)throw new Error('Runtime build SHA '+String(live?.build?.gitSha||'unknown')+' does not match '+sha+'.');
    const edgeVersion=process.env.P16_EDGE_VERSION?Number(process.env.P16_EDGE_VERSION):null;
    const bundle=String(process.env.P16_EDGE_BUNDLE_SHA256||'').trim()||null;
    const frontend=String(process.env.P16_FRONTEND_SHA||'').trim()||null;
    const out=await automation('deployment',{
      gitSha:sha,
      edgeFunctionVersion:Number.isInteger(edgeVersion)&&edgeVersion>0?edgeVersion:null,
      edgeBundleSha256:bundle,
      frontendSha:frontend
    });
    console.log(JSON.stringify(out,null,2));
    return;
  }

  if(mode==='certify'){
    const out=await automation('certify',{});
    console.log(JSON.stringify(out,null,2));
    if(out?.certification?.status!=='passed')throw new Error('Production certification failed.');
    return;
  }

  if(mode==='health'){
    console.log(JSON.stringify(await health({attempts:1}),null,2));
    return;
  }

  throw new Error('Usage: node operations/p16-release-control.mjs <admit|event|deployment|certify|health>');
}

main().catch(error=>{console.error(error?.stack||String(error));process.exit(1);});
