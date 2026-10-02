import fs from 'node:fs';
import process from 'node:process';

const PROD_BASE='https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
const AUDIENCE='gomoku-production-control';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function oidcToken(){
  const url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,bearer=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!url||!bearer)throw new Error('GitHub OIDC environment is unavailable.');
  const res=await fetch(url+(url.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE),{
    headers:{Authorization:'Bearer '+bearer,Accept:'application/json'}
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.value)throw new Error('Could not obtain GitHub OIDC token: '+res.status);
  return data.value;
}
async function call(base,path,body,{attempts=8}={}){
  let last;
  for(let i=0;i<attempts;i++){
    const token=await oidcToken();
    const res=await fetch(base+'/api/automation/p17/'+path,{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const data=await res.json().catch(()=>({}));
    if(res.ok)return data;
    last=Object.assign(new Error(data?.error||('P17 control request failed: '+res.status)),{status:res.status,data});
    if(![404,502,503].includes(res.status)||i===attempts-1)throw last;
    await sleep(4000);
  }
  throw last;
}
function manifest(){
  const file=process.env.P17_MANIFEST_FILE||'/tmp/p17-release-manifest.json';
  return JSON.parse(fs.readFileSync(file,'utf8'));
}
function gitSha(){
  const value=String(process.env.P17_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(value))throw new Error('P17_GIT_SHA must be an immutable 40-character Git SHA.');
  return value;
}
function targetBase(){
  return String(process.env.P17_TARGET_BASE||PROD_BASE).replace(/\/$/,'');
}
async function main(){
  const mode=String(process.argv[2]||'').toLowerCase(),m=manifest(),sha=gitSha();

  if(mode==='register-environment'){
    const projectRef=String(process.env.P17_PREVIEW_PROJECT_ID||'').trim().toLowerCase();
    if(!/^[a-z0-9]{20}$/.test(projectRef))throw new Error('P17_PREVIEW_PROJECT_ID is invalid.');
    const out=await call(PROD_BASE,'environment',{
      environment:process.env.P17_ENVIRONMENT||'preview',
      projectRef,
      branchId:process.env.P17_PREVIEW_BRANCH_ID||null,
      branchName:process.env.P17_PREVIEW_BRANCH_NAME||null,
      branchStatus:process.env.P17_PREVIEW_BRANCH_STATUS||'ready',
      requiredForPromotion:true,
      source:process.env.P17_ENVIRONMENT_SOURCE||'supabase_branch'
    });
    console.log(JSON.stringify(out,null,2));return;
  }
  if(mode==='schema-state'){
    const out=await call(targetBase(),'schema-state',{
      environmentLabel:process.env.P17_ENVIRONMENT_LABEL||'preview',
      schemaManifestSha256:m.schemaManifestSha256,
      edgeManifestSha256:m.edgeManifestSha256,
      releaseManifestSha256:m.releaseManifestSha256,
      sourceGitSha:sha,
      migrationCount:m.migrationCount,
      migrationHead:m.migrationHead
    });
    console.log(JSON.stringify(out,null,2));return;
  }
  if(mode==='migration-event'){
    const name=process.env.P17_MIGRATION_NAME||'',item=m.migrations.find(x=>x.name===name);
    if(!item)throw new Error('P17_MIGRATION_NAME is not present in the manifest.');
    const out=await call(targetBase(),'migration-event',{
      environmentLabel:process.env.P17_ENVIRONMENT_LABEL||'preview',
      sourceGitSha:sha,migrationName:item.name,migrationSha256:item.sha256,
      releaseManifestSha256:m.releaseManifestSha256,
      result:process.env.P17_MIGRATION_RESULT||'applied',
      details:{phase:'P17',transactional:true}
    });
    console.log(JSON.stringify(out,null,2));return;
  }
  if(mode==='preview-certification'){
    const probe=JSON.parse(fs.readFileSync(process.env.P17_PREVIEW_PROBE_FILE||'/tmp/p17-preview-probe.json','utf8'));
    const projectRef=String(process.env.P17_PREVIEW_PROJECT_ID||'').trim().toLowerCase();
    const state=probe?.environment?.schemaState||{};
    const checks={
      branchHealthy:process.env.P17_PREVIEW_BRANCH_STATUS==='ready',
      migrationReplayPassed:process.env.P17_MIGRATION_REPLAY_PASSED==='true',
      migrationHistoryAligned:state.releaseManifestSha256===m.releaseManifestSha256,
      schemaContractsPassed:Object.values(probe?.environment?.checks||{}).every(Boolean),
      edgeBuildMatches:probe?.build?.gitSha===sha,
      edgeHealthHealthy:probe?.reliability?.status==='healthy',
      runtimeIsPreview:String(probe?.build?.channel||'').startsWith('preview'),
      isolationConfirmed:projectRef!==''&&projectRef!=='hycegznamzjhwinegaai',
      rollbackRehearsalPassed:process.env.P17_ROLLBACK_REHEARSAL_PASSED==='true'
    };
    const out=await call(PROD_BASE,'preview-certification',{
      sourceGitSha:sha,sourceRef:'refs/heads/main',environment:'preview',projectRef,
      branchId:process.env.P17_PREVIEW_BRANCH_ID||null,
      branchStatus:process.env.P17_PREVIEW_BRANCH_STATUS||'unknown',
      schemaManifestSha256:m.schemaManifestSha256,edgeManifestSha256:m.edgeManifestSha256,
      releaseManifestSha256:m.releaseManifestSha256,edgeBuildSha:probe?.build?.gitSha,
      migrationCount:m.migrationCount,migrationHead:m.migrationHead,checks
    });
    console.log(JSON.stringify(out,null,2));
    if(out?.certification?.status!=='passed')throw new Error('Preview certification failed.');
    return;
  }
  if(mode==='authorize-promotion'){
    const out=await call(PROD_BASE,'authorize-promotion',{
      productionGitSha:sha,schemaManifestSha256:m.schemaManifestSha256,
      edgeManifestSha256:m.edgeManifestSha256,releaseManifestSha256:m.releaseManifestSha256
    });
    console.log(JSON.stringify(out,null,2));
    if(out?.authorization?.decision!=='authorized')throw new Error('Production promotion was not authorized.');
    fs.writeFileSync('/tmp/p17-promotion-authorization.json',JSON.stringify(out.authorization,null,2));
    return;
  }
  if(mode==='production-deployment'){
    const out=await call(PROD_BASE,'production-deployment',{gitSha:sha,frontendSha:process.env.P17_FRONTEND_SHA||sha});
    console.log(JSON.stringify(out,null,2));return;
  }
  if(mode==='production-certify'){
    const out=await call(PROD_BASE,'production-certify',{});
    console.log(JSON.stringify(out,null,2));
    if(out?.certification?.status!=='passed')throw new Error('Promoted production certification failed.');
    return;
  }
  if(mode==='promotion-event'){
    const auth=JSON.parse(fs.readFileSync(process.env.P17_AUTH_FILE||'/tmp/p17-promotion-authorization.json','utf8'));
    const out=await call(PROD_BASE,'promotion-event',{
      authorizationId:auth.id,eventType:process.env.P17_PROMOTION_EVENT||'started',
      productionMigrationHead:process.env.P17_PRODUCTION_MIGRATION_HEAD||m.migrationHead,
      details:{releaseManifestSha256:m.releaseManifestSha256,phase:'P17'}
    });
    console.log(JSON.stringify(out,null,2));return;
  }

  throw new Error('Usage: node operations/p17-release-control.mjs <register-environment|schema-state|migration-event|preview-certification|authorize-promotion|promotion-event|production-deployment|production-certify>');
}
main().catch(error=>{console.error(error?.stack||String(error));process.exit(1);});
