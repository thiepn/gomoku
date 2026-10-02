import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=process.cwd();
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const migrationsDir=path.join(root,'supabase','migrations');
const migrationFiles=fs.readdirSync(migrationsDir)
  .filter(name=>/\.sql$/i.test(name))
  .sort((a,b)=>a.localeCompare(b));

const migrations=migrationFiles.map(name=>{
  const content=fs.readFileSync(path.join(migrationsDir,name));
  return {name,sha256:sha256(content),bytes:content.length};
});
const schemaCanonical=migrations.map(x=>x.name+'\n'+x.sha256+'\n').join('');
const schemaManifestSha256=sha256(schemaCanonical);

const edgeFiles=[
  'supabase/functions/gomoku-room/index.ts',
  'supabase/functions/gomoku-room/rules.js',
  'supabase/config.toml'
];
const edge=edgeFiles.map(name=>{
  const content=fs.readFileSync(path.join(root,name));
  return {name,sha256:sha256(content),bytes:content.length};
});
const edgeCanonical=edge.map(x=>x.name+'\n'+x.sha256+'\n').join('');
const edgeManifestSha256=sha256(edgeCanonical);
const releaseManifestSha256=sha256('schema:'+schemaManifestSha256+'\nedge:'+edgeManifestSha256+'\n');

const result={
  version:'p17.v1',
  sourceGitSha:String(process.env.P17_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase()||null,
  schemaManifestSha256,
  edgeManifestSha256,
  releaseManifestSha256,
  migrationCount:migrations.length,
  migrationHead:migrations.at(-1)?.name||null,
  migrations,
  edge
};

const target=process.env.P17_MANIFEST_FILE||'/tmp/p17-release-manifest.json';
fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n');

if(process.env.GITHUB_OUTPUT){
  fs.appendFileSync(process.env.GITHUB_OUTPUT,[
    'schema_manifest_sha256='+schemaManifestSha256,
    'edge_manifest_sha256='+edgeManifestSha256,
    'release_manifest_sha256='+releaseManifestSha256,
    'migration_count='+migrations.length,
    'migration_head='+(result.migrationHead||''),
    'manifest_file='+target
  ].join('\n')+'\n');
}
console.log(JSON.stringify(result,null,2));
