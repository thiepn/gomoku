import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const out=path.resolve(process.env.P18_WORKSPACE||'.p18-portable');
const supabaseDir=path.join(out,'supabase');
const migrationsDir=path.join(supabaseDir,'migrations');
const functionDir=path.join(supabaseDir,'functions','gomoku-room');
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(migrationsDir,{recursive:true});
fs.mkdirSync(functionDir,{recursive:true});

const sourceMigrations=fs.readdirSync(path.join(root,'supabase','migrations'))
  .filter(name=>/\.sql$/i.test(name))
  .sort((a,b)=>a.localeCompare(b));

const bootstrapSource=path.join(root,'operations','p18-shared-contract-bootstrap.sql');
const bootstrap=fs.readFileSync(bootstrapSource);
fs.writeFileSync(path.join(migrationsDir,'20000101000000_p18_shared_contract_bootstrap.sql'),bootstrap);

const mapping=[];
sourceMigrations.forEach((name,index)=>{
  const ordinal=String(index+1).padStart(2,'0');
  const portable='200001010000'+ordinal+'_'+name.replace(/^[0-9]+_/,'');
  const content=fs.readFileSync(path.join(root,'supabase','migrations',name));
  fs.writeFileSync(path.join(migrationsDir,portable),content);
  mapping.push({
    order:index+1,
    source:name,
    portable,
    sha256:sha256(content),
    bytes:content.length
  });
});

const config=[
  'project_id = "gomoku-p18-portable"',
  '',
  '[db]',
  'major_version = 17',
  '',
  '[db.seed]',
  'enabled = false',
  '',
  '[functions.gomoku-room]',
  'verify_jwt = false',
  ''
].join('\n');
fs.writeFileSync(path.join(supabaseDir,'config.toml'),config);

for(const name of ['index.ts','rules.js']){
  fs.copyFileSync(
    path.join(root,'supabase','functions','gomoku-room',name),
    path.join(functionDir,name)
  );
}
const gitSha=String(process.env.P18_GIT_SHA||process.env.GITHUB_SHA||'LOCAL').trim().toLowerCase();
const buildSha=/^[0-9a-f]{40}$/.test(gitSha)?gitSha:'LOCAL';
fs.writeFileSync(path.join(functionDir,'build-meta.ts'),
  "export const BUILD_GIT_SHA='"+buildSha+"';\nexport const BUILD_CHANNEL='preview-p18-local';\n");

const manifest={
  version:'p18.portable.v1',
  sourceGitSha:/^[0-9a-f]{40}$/.test(gitSha)?gitSha:null,
  postgresMajor:17,
  workspace:path.relative(root,out),
  bootstrap:{
    source:path.relative(root,bootstrapSource),
    sha256:sha256(bootstrap),
    bytes:bootstrap.length
  },
  migrations:mapping,
  migrationCount:mapping.length,
  migrationHead:mapping.at(-1)?.source||null,
  portableHead:mapping.at(-1)?.portable||null,
  edge:[
    'supabase/functions/gomoku-room/index.ts',
    'supabase/functions/gomoku-room/rules.js'
  ].map(name=>{
    const content=fs.readFileSync(path.join(root,name));
    return {name,sha256:sha256(content),bytes:content.length};
  }),
  generatedAt:new Date().toISOString()
};
const manifestPath=path.join(out,'p18-portable-manifest.json');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');

if(process.env.GITHUB_OUTPUT){
  fs.appendFileSync(process.env.GITHUB_OUTPUT,[
    'workspace='+out,
    'manifest='+manifestPath,
    'migration_count='+mapping.length,
    'migration_head='+(manifest.migrationHead||'')
  ].join('\n')+'\n');
}
console.log(JSON.stringify(manifest,null,2));
