import fs from 'node:fs';
import process from 'node:process';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const productionRef='hycegznamzjhwinegaai';
const previewRef=String(process.env.P18_HOSTED_PREVIEW_PROJECT_ID||'').trim().toLowerCase();
const previewUrl=String(process.env.P18_HOSTED_PREVIEW_DB_URL||'').trim();
const productionUrl=String(process.env.P18_PRODUCTION_DB_URL||'').trim();
const current=String(process.env.P17_GIT_SHA||process.env.P18_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
const token=String(process.env.SUPABASE_ACCESS_TOKEN||'');

if(!/^[0-9a-f]{40}$/.test(current))throw new Error('An immutable candidate Git SHA is required.');
if(!/^[a-z0-9]{20}$/.test(previewRef)||previewRef===productionRef)throw new Error('P18_HOSTED_PREVIEW_PROJECT_ID must be a distinct Supabase project ref.');
if(previewUrl&&!previewUrl.includes(previewRef))throw new Error('Preview DB URL does not match P18_HOSTED_PREVIEW_PROJECT_ID.');
if(productionUrl&&!productionUrl.includes(productionRef))throw new Error('Production DB URL does not match the THIEPN Account production project.');

function psql(url,args,{capture=false}={}){
  if(!url)throw new Error('Database URL is required for this operation.');
  const out=execFileSync('psql',[url,'-X','-v','ON_ERROR_STOP=1',...args],{
    encoding:capture?'utf8':undefined,
    stdio:capture?['ignore','pipe','inherit']:'inherit',
    maxBuffer:32*1024*1024
  });
  return capture?String(out).trim():'';
}
function canonicalMigrations(){
  return fs.readdirSync('supabase/migrations').filter(x=>/\.sql$/i.test(x)).sort((a,b)=>a.localeCompare(b));
}
function baseSha(url){
  try{
    const value=psql(url,['-At','-c',"select coalesce(source_git_sha,'') from public.gomoku_repo_schema_state where id=1"],{capture:true});
    return /^[0-9a-f]{40}$/.test(value)?value:null;
  }catch{return null;}
}
function changed(base){
  const all=canonicalMigrations();
  if(!base)return all;
  const out=execFileSync('git',['diff','--name-only',base,current,'--','supabase/migrations'],{encoding:'utf8'}).trim();
  if(!out)return [];
  const known=new Set(all);
  const changed=out.split(/\r?\n/).filter(x=>x.endsWith('.sql')).map(x=>x.replace(/^supabase\/migrations\//,'')).sort();
  for(const name of changed)if(!known.has(name))throw new Error('Changed migration not found: '+name);
  return changed;
}
function rejectNonTransactional(name,sql){
  if(/\b(create\s+index\s+concurrently|drop\s+index\s+concurrently|vacuum|reindex\s+concurrently)\b/i.test(sql))
    throw new Error('P18 automatic replay rejects non-transactional SQL in '+name);
}
function writePlan(url,label,requireBase=false){
  const base=baseSha(url);
  if(requireBase&&!base)throw new Error('Production repo schema baseline is unavailable; refusing automatic replay.');
  const migrations=changed(base);
  const plan={label,baseSourceGitSha:base,currentGitSha:current,migrations};
  fs.writeFileSync('/tmp/p18-'+label+'-plan.json',JSON.stringify(plan,null,2));
  console.log(JSON.stringify(plan,null,2));
}
function runPlan(url,label,mode){
  const file='/tmp/p18-'+label+'-plan.json';
  const plan=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!plan.baseSourceGitSha){
    const bootstrap=fs.readFileSync('operations/p18-shared-contract-bootstrap.sql','utf8');
    psql(url,['-c','begin;\n'+bootstrap+'\ncommit;']);
  }
  for(const name of plan.migrations){
    const sql=fs.readFileSync('supabase/migrations/'+name,'utf8');
    rejectNonTransactional(name,sql);
    psql(url,['-c','begin;\n'+sql+'\n'+(mode==='rehearse'?'rollback;':'commit;')]);
  }
  console.log((mode==='rehearse'?'PASS rehearsal ':'APPLIED ')+label+': '+(plan.migrations.join(', ')||'no migrations'));
}
async function management(path){
  if(!token)throw new Error('SUPABASE_ACCESS_TOKEN is required for hosted preview API discovery.');
  const res=await fetch('https://api.supabase.com'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error('Supabase Management API '+path+' -> '+res.status+' '+JSON.stringify(data));
  return data;
}
async function exportApi(){
  const keys=await management('/v1/projects/'+previewRef+'/api-keys?reveal=true');
  const rows=Array.isArray(keys)?keys:(keys?.keys||[]);
  const key=rows.find(x=>x.type==='publishable')||rows.find(x=>x.name==='anon')||rows.find(x=>x.type==='anon');
  const value=key?.api_key||key?.key||key?.value;
  if(!value)throw new Error('No preview publishable/anon key was found.');
  if(process.env.GITHUB_ENV){
    fs.appendFileSync(process.env.GITHUB_ENV,[
      'P17_PREVIEW_PROJECT_ID='+previewRef,
      'P17_PREVIEW_BRANCH_STATUS=ready',
      'P17_ENVIRONMENT_SOURCE=dedicated_project',
      'P17_PREVIEW_BRANCH_NAME=p18-free-hosted-preview',
      'GOMOKU_ROOM_API=https://'+previewRef+'.supabase.co/functions/v1/gomoku-room',
      'GOMOKU_ROOM_KEY='+value
    ].join('\n')+'\n');
  }
  console.log(JSON.stringify({projectRef:previewRef,keyType:'publishable-or-anon'},null,2));
}

const mode=String(process.argv[2]||'').toLowerCase();
if(mode==='plan-preview')writePlan(previewUrl,'preview');
else if(mode==='rehearse-preview')runPlan(previewUrl,'preview','rehearse');
else if(mode==='apply-preview')runPlan(previewUrl,'preview','apply');
else if(mode==='plan-production'){
  if(!productionUrl)throw new Error('P18_PRODUCTION_DB_URL is required for safe hosted promotion.');
  writePlan(productionUrl,'production',true);
}
else if(mode==='rehearse-production')runPlan(productionUrl,'production','rehearse');
else if(mode==='apply-production')runPlan(productionUrl,'production','apply');
else if(mode==='export-api')await exportApi();
else throw new Error('Usage: node operations/p18-hosted-preview.mjs <plan-preview|rehearse-preview|apply-preview|plan-production|rehearse-production|apply-production|export-api>');
