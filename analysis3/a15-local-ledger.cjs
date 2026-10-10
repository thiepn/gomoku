/* A15 local replay ledger adapter. Durable for one controlled filesystem, NOT globally attested. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const A14=require('./a14-custody.cjs'),PINS=require('./a15-evidence-pins.json');
const H32=/^[a-f0-9]{32}$/i,H64=/^[a-f0-9]{64}$/i;
const ZERO='0'.repeat(64);
function result(status,reason,more={}){
 return {format:'GomokuA15LocalReplayReceipt',version:15,status,reason,...more,
  canAuthorizeHuman:false,canCertifyStable:false,canMerge:false,canDeploy:false,canCloseRelease:false,
  notice:'Local source-bound replay accounting is NOT independently controlled, signed or globally tamper-proof. A second reviewer must anchor and audit this chain externally.'};
}
function genesis(){return {format:'GomokuA15Ledger',version:15,repository:'thiepn/gomoku',
 a14HeadSha:PINS.a14HeadSha,entries:[],head:ZERO};}
function validate(doc){
 if(!doc||doc.format!=='GomokuA15Ledger'||doc.version!==15||
   doc.repository!=='thiepn/gomoku'||doc.a14HeadSha!==PINS.a14HeadSha||
   !Array.isArray(doc.entries)||doc.entries.length>10000||!H64.test(doc.head||''))
  throw Error('Corrupt ledger identity, version, size, or head digest.');
 let prior=ZERO;
 const issued=new Map(),consumed=new Set();
 for(let i=0;i<doc.entries.length;i++){
  const e=doc.entries[i];if(!e||e.seq!==i+1||e.previous!==prior||
   !['issue','consume'].includes(e.action)||!H32.test(e.challenge||'')||
   !H64.test(e.scopeDigest||'')||typeof e.deploymentId!=='string'||!e.deploymentId.trim()||
   typeof e.actor!=='string'||!e.actor.trim()||!Number.isSafeInteger(e.atMs)||e.atMs<0||
   !H64.test(e.digest||''))
   throw Error('Invalid ledger record/chain link at sequence '+(i+1));
  const {digest:_,...body}=e;
  if(A14.sha(body)!==e.digest)throw Error('Ledger integrity digest mismatch at '+(i+1));
  if(e.action==='issue'){
   if(issued.has(e.challenge)||!Number.isSafeInteger(e.expiresAtMs)||e.expiresAtMs<=e.atMs||
    e.expiresAtMs-e.atMs>7*86400000)throw Error('Duplicate or invalid issued challenge.');
   issued.set(e.challenge,e);
  }else{
   const priorIssue=issued.get(e.challenge);
   if(!priorIssue||consumed.has(e.challenge)||priorIssue.scopeDigest!==e.scopeDigest||
    priorIssue.deploymentId!==e.deploymentId||e.atMs<priorIssue.atMs||
    e.atMs>priorIssue.expiresAtMs||!H64.test(e.packetDigest||''))
    throw Error('Replay, unknown issuance, expired challenge or scope mismatch.');
   consumed.add(e.challenge);
  }
  prior=e.digest;
 }
 if(prior!==doc.head)throw Error('Ledger head does not match most recent append.');
 return {issued,consumed,head:prior,count:doc.entries.length};
}
function commit(dir,doc){
 const target=path.join(dir,'a15-replay-ledger.json');
 const tmp=path.join(dir,'.a15-replay-'+crypto.randomBytes(12).toString('hex')+'.tmp');
 let fd;
 try{
  fd=fs.openSync(tmp,'wx',0o600);
  fs.writeFileSync(fd,JSON.stringify(doc,null,2)+'\n','utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=null;
  fs.renameSync(tmp,target);
  const df=fs.openSync(dir,'r');try{fs.fsyncSync(df);}finally{fs.closeSync(df);}
 }finally{if(fd!==undefined&&fd!==null)fs.closeSync(fd);try{fs.unlinkSync(tmp);}catch{}}
}
function transact({directory,approved=false,action,deploymentId,actor,scopeDigest,challenge,
 packetDigest,nowMs=Date.now(),ttlMs=3600000}={}){
 if(approved!==true)return result('blocked-permission','A15 local ledger write requires exact explicit operator opt-in.');
 if(typeof directory!=='string'||!path.isAbsolute(directory))return result('blocked-path','Supply an existing absolute isolated directory.');
 if(typeof actor!=='string'||!actor.trim()||typeof deploymentId!=='string'||!deploymentId.trim()||
  !H64.test(scopeDigest||'')||!Number.isSafeInteger(nowMs)||nowMs<0)
  return result('blocked-input','Missing bound deployment, evidence scope, actor, or valid clock.');
 if(!['issue','consume'].includes(action))return result('blocked-action','Only issue and consume are supported.');
 if(action==='consume'&&(!H32.test(challenge||'')||!H64.test(packetDigest||'')))
  return result('blocked-input','Consumption requires original issued challenge and packet digest.');
 if(action==='issue'&&(!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>7*86400000))
  return result('blocked-input','Challenge lifetime must be between 1 millisecond and 7 days.');
 let fd=null,lock=null;
 try{
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.statSync(directory).isDirectory()||
   fs.realpathSync(directory)!==directory)
   return result('blocked-path','Ledger directory must be a canonical real directory, not a symlink.');
  lock=path.join(directory,'.a15-replay-ledger.lock');
  fd=fs.openSync(lock,'wx',0o600);
  const target=path.join(directory,'a15-replay-ledger.json');
  let doc=genesis();
  if(fs.existsSync(target)){
   const st=fs.lstatSync(target);
   if(!st.isFile()||st.isSymbolicLink()||st.size>3_000_000)
    throw Error('Replay ledger is not a bounded regular file.');
   doc=JSON.parse(fs.readFileSync(target,'utf8'));
  }
  const state=validate(doc);
  const code=action==='issue'?crypto.randomBytes(16).toString('hex'):challenge;
  if(state.issued.has(code)||action==='consume'&&state.consumed.has(code))
   return result('blocked-replay','Challenge has already been issued or consumed.');
  if(action==='consume'){
   const orig=state.issued.get(code);
   if(!orig)return result('blocked-replay','Challenge was not issued by this controlled ledger.');
   if(orig.scopeDigest!==scopeDigest||orig.deploymentId!==deploymentId||
    nowMs<orig.atMs||nowMs>orig.expiresAtMs)
    return result('blocked-replay','Consumed challenge does not match bound deployment, scope or expiry.');
  }
  const e={seq:state.count+1,action,challenge:code,scopeDigest,deploymentId,actor,
   atMs:nowMs,previous:state.head};
  if(action==='issue')e.expiresAtMs=nowMs+ttlMs;
  else e.packetDigest=packetDigest;
  e.digest=A14.sha(e);
  doc.entries.push(e);doc.head=e.digest;
  validate(doc);
  commit(directory,doc);
  return result(action==='issue'?'issued-local-challenge':'consumed-local-challenge',
   'Atomic local record appended, but its issuer and history remain externally untrusted.',
   {challenge:code,recordDigest:e.digest,head:e.digest,sequence:e.seq});
 }catch(err){
  return result('blocked-ledger',String(err?.message||err));
 }finally{
  if(fd!==null){fs.closeSync(fd);try{fs.unlinkSync(lock);}catch{}}
 }
}
function inspect(directory){
 try{
  const doc=JSON.parse(fs.readFileSync(path.join(directory,'a15-replay-ledger.json'),'utf8'));
  const v=validate(doc);
  return result('local-chain-valid-unanchored','Chain hashes and single-use states pass local verification; external independent custody still absent.',
   {count:v.count,head:v.head,issued:v.issued.size,consumed:v.consumed.size});
 }catch(e){return result('blocked-ledger',String(e?.message||e));}
}
module.exports={transact,inspect,validate,genesis};
