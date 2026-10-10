/* A17 isolated file byte rehearsal; NEVER a hosted restore, prod deployment or DB migration. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('./a17-operator-gate.cjs'),LOCK=require('./a10-source-lock.json');
const A9=require('./rc9-core.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const max=10*1024*1024;
function readAsset(root,name){
 const rel=name.split('/');
 if(rel.some(x=>!x||x==='.'||x==='..'))throw Error('Traversal not allowed.');
 let current=root;
 for(const p of rel){
  current=path.join(current,p);
  const st=fs.lstatSync(current);
  if(st.isSymbolicLink())throw Error('Symlink path component disallowed.');
  if(p!==rel.at(-1)&&!st.isDirectory())throw Error('Non-directory ancestor.');
 }
 const st=fs.lstatSync(current);
 if(!st.isFile()||st.size<1||st.size>max)throw Error('Invalid or unbounded asset '+name);
 return fs.readFileSync(current);
}
function snapshot(root,expected){
 if(typeof root!=='string'||!path.isAbsolute(root)||fs.realpathSync(root)!==root||
    !fs.statSync(root).isDirectory())throw Error('Only absolute canonical real source directories allowed.');
 if(Object.keys(expected||{}).sort().join('|')!==[...A9.ASSETS].sort().join('|'))
  throw Error('Exactly eight allowlisted static file hashes are required.');
 const bytes={};
 for(const p of A9.ASSETS){
  const b=readAsset(root,p);if(sha(b)!==expected[p])throw Error('Source snapshot byte drift: '+p);
  bytes[p]=b;
 }
 return bytes;
}
function writeSnapshot(dir,s){
 for(const p of A9.ASSETS){
  const name=path.join(dir,p);
  fs.mkdirSync(path.dirname(name),{recursive:true});
  fs.writeFileSync(name,s[p],{flag:'wx',mode:0o600});
 }
}
function restoreSnapshot(dir,s){
 for(const p of A9.ASSETS){
  const name=path.join(dir,p);
  fs.writeFileSync(name,s[p],{flag:'w',mode:0o600});
 }
}
function rehearse({approval,approved=false,workspace,originalRoot,originalHashes,
 previousRoot,previousHashes,previousStableArchiveSha256,syntheticRecord,
 clock=()=>new Date()}={}){
 const gate=G.validate({approval,approved,operation:'isolated-restore',now:clock()});
 if(gate.status!=='scoped-document-only')return gate;
 if(typeof workspace!=='string'||!path.isAbsolute(workspace)||!fs.existsSync(workspace)||
  fs.realpathSync(workspace)!==workspace||!fs.statSync(workspace).isDirectory())
  return G.result('blocked-workspace','Rehearsal requires an existing canonical isolated workspace.');
 if(!/^[a-f0-9]{64}$/.test(previousStableArchiveSha256||'')||
   previousStableArchiveSha256===LOCK.offlineZipSha256||
   originalHashes?.['index.html']===previousHashes?.['index.html']||
   originalHashes?.['index.html']!==require('./a15-public-archive-observation.json').a9.assetByteHashes['index.html'])
  return G.result('blocked-previous-stable','A distinct previous stable image and archive identity must be verified.');
 if(typeof syntheticRecord!=='string'||!syntheticRecord.startsWith('SYNTHETIC:')||
  syntheticRecord.length>1024||syntheticRecord.length<16)
  return G.result('blocked-data','Only a synthetic record sentinel is supported. Never supply actual player records.');
 let staging;
 try{
  const current=snapshot(originalRoot,originalHashes),previous=snapshot(previousRoot,previousHashes);
  if([originalRoot,previousRoot].includes(workspace)||
    [originalRoot,previousRoot].some(r=>workspace.startsWith(r+path.sep)||r.startsWith(workspace+path.sep)))
   return G.result('blocked-workspace','Rehearsal workspace must be disjoint from source asset directories.');
  staging=fs.mkdtempSync(path.join(workspace,'.a17-dryrun-'));
  const shell=path.join(staging,'isolated-shell');
  fs.mkdirSync(shell,0o700);writeSnapshot(shell,previous);
  const sentinelFile=path.join(staging,'synthetic-record.txt');
  fs.writeFileSync(sentinelFile,syntheticRecord,{flag:'wx',mode:0o600});
  restoreSnapshot(shell,current);
  const candidateOk=A9.ASSETS.every(p=>sha(readAsset(shell,p))===originalHashes[p]);
  restoreSnapshot(shell,previous);
  const rollbackOk=A9.ASSETS.every(p=>sha(readAsset(shell,p))===previousHashes[p]);
  const preserved=fs.readFileSync(sentinelFile,'utf8')===syntheticRecord;
  if(!candidateOk||!rollbackOk||!preserved)throw Error('Isolated apply/restore or synthetic saved record verification failed.');
  return G.result('isolated-restore-rehearsed-only','All eight synthetic workspace assets transitioned and reverted; source assets and production were never written.',
   {assets:8,initialAndFinal:'previous-stable',candidateAppliedThenRestored:true,
    syntheticRecordPreserved:true,previousStableArchiveSha256,originalSourceSha:LOCK.sourceSha,
    approvalScopeDigest:gate.scopeDigest,realRollbackAccepted:false});
 }catch(e){return G.result('blocked-isolated-rehearsal',String(e.message))}
 finally{if(staging)fs.rmSync(staging,{recursive:true,force:true});}
}
module.exports={rehearse,snapshot,readAsset};
