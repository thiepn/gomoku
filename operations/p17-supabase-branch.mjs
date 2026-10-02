import fs from 'node:fs';
import process from 'node:process';
import {execFileSync} from 'node:child_process';

const token=process.env.SUPABASE_ACCESS_TOKEN||'';
const productionRef='hycegznamzjhwinegaai';
const previewRef=String(process.env.P17_PREVIEW_PROJECT_ID||'').trim().toLowerCase();
const branchRef=String(process.env.P17_PREVIEW_BRANCH_ID||previewRef).trim();
const manifestFile=process.env.P17_MANIFEST_FILE||'/tmp/p17-release-manifest.json';
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const current=String(process.env.P17_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();

if(!token)throw new Error('SUPABASE_ACCESS_TOKEN is required for P17 branch operations.');
if(!/^[a-z0-9]{20}$/.test(previewRef))throw new Error('P17_PREVIEW_PROJECT_ID is invalid.');
if(previewRef===productionRef)throw new Error('P17 preview project must be distinct from production.');

async function management(path,init={}){
  const res=await fetch('https://api.supabase.com'+path,{
    ...init,
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(init.headers||{})}
  });
  const text=await res.text();let data={};
  try{data=text?JSON.parse(text):{};}catch{data={message:text};}
  if(!res.ok)throw new Error('Supabase Management API '+path+' -> '+res.status+' '+JSON.stringify(data));
  return data;
}
async function publishableKey(ref){
  const keys=await management('/v1/projects/'+ref+'/api-keys?reveal=true');
  const rows=Array.isArray(keys)?keys:(keys?.keys||[]);
  const key=rows.find(x=>x.type==='publishable')||rows.find(x=>x.name==='anon')||rows.find(x=>x.type==='anon');
  const value=key?.api_key||key?.key||key?.value;
  if(!value)throw new Error('No publishable/anon API key available for '+ref+'.');
  return value;
}
async function probe(ref){
  const key=await publishableKey(ref);
  const res=await fetch('https://'+ref+'.supabase.co/functions/v1/gomoku-room/api/environment/probe',{
    headers:{apikey:key},cache:'no-store'
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error('Environment probe '+ref+' -> '+res.status+' '+JSON.stringify(data));
  return data;
}
function changedMigrations(baseSha){
  if(!/^[0-9a-f]{40}$/.test(baseSha||''))throw new Error('Preview schema state does not contain an immutable baseline Git SHA.');
  const out=execFileSync('git',['diff','--name-only',baseSha,current,'--','supabase/migrations'],{encoding:'utf8'}).trim();
  if(!out)return [];
  const names=out.split(/\r?\n/).filter(x=>x.endsWith('.sql')).map(x=>x.replace(/^supabase\/migrations\//,''));
  const known=new Set(manifest.migrations.map(x=>x.name));
  for(const name of names)if(!known.has(name))throw new Error('Changed migration is absent from manifest: '+name);
  return names.sort();
}
function applySql(url,sql){
  execFileSync('psql',[url,'-X','-v','ON_ERROR_STOP=1','-c',sql],{stdio:'inherit',maxBuffer:20*1024*1024});
}
async function main(){
  const mode=String(process.argv[2]||'').toLowerCase();

  if(mode==='probe-preview'){
    const data=await probe(previewRef);
    fs.writeFileSync('/tmp/p17-preview-probe.json',JSON.stringify(data,null,2));
    console.log(JSON.stringify(data,null,2));return;
  }
  if(mode==='probe-production'){
    const data=await probe(productionRef);
    fs.writeFileSync('/tmp/p17-production-probe.json',JSON.stringify(data,null,2));
    console.log(JSON.stringify(data,null,2));return;
  }
  if(mode==='plan'){
    const data=await probe(previewRef),base=data?.environment?.schemaState?.sourceGitSha;
    const names=changedMigrations(base);
    fs.writeFileSync('/tmp/p17-migration-plan.json',JSON.stringify({baseSourceGitSha:base,currentGitSha:current,migrations:names},null,2));
    console.log(JSON.stringify({baseSourceGitSha:base,currentGitSha:current,migrations:names},null,2));return;
  }
  if(mode==='rehearse'||mode==='apply'){
    const plan=JSON.parse(fs.readFileSync('/tmp/p17-migration-plan.json','utf8'));
    const url=process.env.POSTGRES_URL_NON_POOLING;
    if(!url)throw new Error('POSTGRES_URL_NON_POOLING is required from supabase branches get.');
    for(const name of plan.migrations){
      const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');
      if(/\b(create\s+index\s+concurrently|drop\s+index\s+concurrently|vacuum|reindex\s+concurrently)\b/i.test(sql))
        throw new Error('P17 transactional promotion rejects non-transactional migration statement in '+name+'.');
      if(mode==='rehearse')applySql(url,'begin;\n'+sql+'\nrollback;');
      else applySql(url,'begin;\n'+sql+'\ncommit;');
    }
    console.log((mode==='rehearse'?'PASS rollback rehearsal: ':'APPLIED preview migrations: ')+(plan.migrations.join(', ')||'none'));
    return;
  }
  if(mode==='merge'){
    const out=await management('/v1/branches/'+encodeURIComponent(branchRef)+'/merge',{method:'POST',body:'{}'});
    console.log(JSON.stringify(out,null,2));return;
  }
  throw new Error('Usage: node operations/p17-supabase-branch.mjs <probe-preview|probe-production|plan|rehearse|apply|merge>');
}
main().catch(error=>{console.error(error?.stack||String(error));process.exit(1);});
