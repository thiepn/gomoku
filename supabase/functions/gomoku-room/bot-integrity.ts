/* E6 match transport integrity. Pure helpers around original E2 rules and
 * original gomoku_bot_matches custody, NOT another match/result/rating engine.
 * SHA-256 seals canonical server transcript bytes against accidental mutation.
 * It does not prove that a time-budgeted AI decision is deterministic.
 */
const MAX_PLIES=227;
function validMove(x:any){
  return x&&Number.isInteger(x.i)&&x.i>=-1&&x.i<225&&[1,2].includes(x.color)&&
    ['player','bot'].includes(x.actor);
}
function canonical(value:any):any {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'&&!ArrayBuffer.isView(value))
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
async function sha256(value:string){
  const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(raw)).map(n=>n.toString(16).padStart(2,'0')).join('');
}
function gameSealPayload(row:any,moves:any[]){
  if(!row||!Array.isArray(moves)||moves.length>MAX_PLIES||!moves.every(validMove))
    throw Error('Invalid game transcript for E6 custody seal.');
  return {
    v:'e6-transcript/1.0.0',id:row.id,owner:row.owner_user_id,
    ruleset:row.ruleset,bot:row.bot_id,playerColor:Number(row.player_color),
    serverSeed:Number(row.server_seed),botSnapshot:row.bot_snapshot,
    moves:moves.map(m=>canonical(m))
  };
}
export async function transcriptHash(row:any,moves:any[]){
  return sha256(JSON.stringify(canonical(gameSealPayload(row,moves))));
}
export async function verifyTranscriptHash(row:any){
  const actual=String(row?.transcript_sha256||'');
  if(!actual)return {status:'legacy-no-seal',sealed:false,legalityMustBeReplayed:true};
  if(!/^[0-9a-f]{64}$/.test(actual))throw Error('Invalid stored transcript seal.');
  const expected=await transcriptHash(row,row.moves);
  if(actual!==expected)throw Error('Verified game transcript digest mismatch.');
  return {status:'sealed-and-matched',sealed:true,legalityMustBeReplayed:true};
}
export async function commandFingerprint(owner:string,matchId:string,commandId:string,
  revision:number,action:string,index:number|null) {
  if(!/^[0-9a-f-]{36}$/i.test(matchId)||!Number.isSafeInteger(revision)||revision<0||
     !['move','resign'].includes(action)||action==='move'&&!Number.isInteger(index))
    throw Error('Invalid human command envelope.');
  return sha256(JSON.stringify(canonical({
    v:'e6-command/1',owner,matchId,commandId,revision,action,
    i:action==='resign'?null:index
  })));
}
export function validateReceipt(value:any){
  if(!value||!['applied','already-applied','conflict','command-mismatch'].includes(value.status)||
     !value.match||!Number.isSafeInteger(Number(value.match.revision)))
    throw Error('The server did not return a verifiable command receipt.');
  return value;
}
export function isExpiredPractice(row:any){
  return row?.status==='abandoned'&&['idle-expiry','user-abandoned'].includes(row.result?.reason)&&
    Number(row.result?.winner)===0&&row.rating_admission?.rated!==true;
}
