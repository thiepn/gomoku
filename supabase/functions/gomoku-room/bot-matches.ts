/* E2: real owner-authenticated bot game custody. NO rating settlement.
 * Uses original Studio search mirrored from script#rules-engine and existing server rules.
 * Bot decisions are made only here; the browser submits only human moves.
 */
import '../../../bot-elo/rating.js';
import { createNativeBotEngine } from './native-bot-engine.js';
import { createEngine } from './rules.js';
import { prepareBotRatingAdmission, settleBotRatingMatch, publicMatchRating } from './bot-rating.ts';
import { POLICY_ID, snapshotForLevel, choosePinnedMove } from '../../../bot-elo/calibration/e2-policy.mjs';
import { transcriptHash, verifyTranscriptHash, commandFingerprint, validateReceipt, isExpiredPractice } from './bot-integrity.ts';

type Services={
  rest:(path:string,init?:{method?:string,body?:unknown,prefer?:string})=>Promise<any>,
  verifiedAccount:(req:Request,required?:boolean)=>Promise<any>,
  readBody:(req:Request)=>Promise<any>,
  enforceRequestLimit:(req:Request,scope:string,limit:number,window:number)=>Promise<any>,
  json:(data:unknown,status?:number)=>Response,
  fail:(error:string,status?:number)=>Response,
  nowIso:()=>string,
  q:(s:string)=>string
};
type BotMove={i:number,color:number,actor:'player'|'bot',decision?:any};
const RULE='renju-practice',POLICY='studio-native-search/e2.1';
const VALID_COMMAND=/^[A-Za-z0-9._:-]{8,96}$/;
const VALID_KEY=/^[A-Za-z0-9._:-]{8,100}$/;
const VALID_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const native=createNativeBotEngine(RULE),rules=createEngine(RULE);
const registry=(globalThis as any).GomokuBotEloE1;
if(!registry?.BOTS||registry.CONFIG?.ratedBackendAvailable!==false)
  throw new Error('E1 uncalibrated bot registry is unavailable.');

function error(reason:string,status=422){return Object.assign(new Error(reason),{status});}
function bot(id:unknown){const value=registry.getBot(String(id||''));if(!value||value.ratingStatus!=='uncalibrated'||value.ratedEnabled!==false)throw error('Unknown or unsupported E2 bot level.');return value;}
function id(value:unknown){const s=String(value||'');if(!VALID_UUID.test(s))throw error('Invalid bot match id.');return s;}
function token(value:unknown,re:RegExp,label:string){const s=String(value||'');if(!re.test(s))throw error('Invalid '+label);return s;}
function seed(){return crypto.getRandomValues(new Uint32Array(1))[0];}
function snapshot(level:any){return snapshotForLevel(level);}

function inspectMoves(moves:any[]){
 if(!Array.isArray(moves)||moves.length>227)throw error('Stored bot transcript is invalid.',500);
 const board=new Int8Array(225),verified:BotMove[]=[];
 let ended:any=null,passes=0,stones=0;
 for(let j=0;j<moves.length;j++){
   const x=moves[j],color=j%2+1,i=x?.i;
   if(!x||!Number.isInteger(i)||i< -1||i>=225||x.color!==color||!['player','bot'].includes(x.actor))
     throw error('Stored bot transcript contains an invalid move.',500);
   if(ended)throw error('Bot transcript continues after game end.',500);
   if(i===-1){
     if(j<3||!rules.legalMove(board,-1,color,j).legal)throw error('Illegal stored pass.',500);
     passes++;
   }else{
     if(board[i]||(j===0&&i!==112))throw error('Invalid stored board move.',500);
     const a=rules.legalMove(board,i,color,j),n=native.legalMove(board,i,color,j);
     if(!a.legal||!n.legal)throw error('Stored bot move violates the original rules.',500);
     board[i]=color;stones++;passes=0;
     if(a.win!==n.win)throw error('Original and online rule kernels disagree.',500);
     if(a.win)ended={winner:color,reason:'five'};
   }
   verified.push(x);
   if(passes>=2)ended={winner:0,reason:'passes'};
   if(stones>=225&&!ended)ended={winner:0,reason:'full'};
 }
 return {board,ended,stones,passes,moves:verified};
}
function inspectRow(row:any){
 const moves=Array.isArray(row?.moves)?row.moves:[],info=inspectMoves(moves);
 for(let j=0;j<moves.length;j++){
   const should=moves[j].color===Number(row.player_color)?'player':'bot';
   if(moves[j].actor!==should)throw error('Bot transcript has a forged actor.',500);
 }
 if(row.status==='active'&&(row.result||info.ended))throw error('Active match terminal integrity mismatch.',500);
 if(row.status==='completed'&&(!info.ended||Number(row.result?.winner)!==info.ended.winner||row.result?.reason!==info.ended.reason))
   throw error('Completed bot result integrity mismatch.',500);
 if(row.status==='resigned'&&(!row.result||row.result.reason!=='resign'||Number(row.result.winner)!==3-Number(row.player_color)||info.ended))
   throw error('Resigned bot result integrity mismatch.',500);
 if(row.status==='abandoned'&&(!isExpiredPractice(row)||info.ended))
   throw error('An abandoned game cannot have a rated or already-terminal result.',500);
 return info;
}
function selectBotMove(moves:BotMove[],snap:any,serverSeed:number){
 const info=inspectMoves(moves),color=moves.length%2+1;
 if(info.ended)throw error('Bot cannot move in a finished game.',409);
 const {decision:candidate,config}=choosePinnedMove(native,info.board,color,snap,serverSeed,moves.length);
 const i=Number(candidate.move),r=rules.legalMove(info.board,i,color,moves.length),
   n=native.legalMove(info.board,i,color,moves.length);
 if(!Number.isInteger(i)||i< -1||i>=225||!r.legal||!n.legal||
    (moves.length===0&&i!==112)||r.win!==n.win)throw error('Native bot returned an unverified move.',503);
 return {i,color,actor:'bot' as const,decision:{
   policy:POLICY_ID,reason:String(candidate.reason||'search').slice(0,48),
   searchDepth:Number(candidate.depth)||0,nodes:Number(candidate.nodes)||0,
   elapsedMs:Number(candidate.elapsedMs)||0,
   seed:config.seed}};
}
function applyHumanMove(row:any,index:number,kind:'move'|'resign'){
 const transcript=inspectRow(row),moves=[...transcript.moves],player=Number(row.player_color);
 if(row.status!=='active')throw error('The bot match is already finished.',409);
 const next=moves.length%2+1;
 if(next!==player)throw error('Wait for the server bot turn.',409);
 let status='active',result:any=null;
 if(kind==='resign'){status='resigned';result={winner:3-player,reason:'resign'};}
 else{
   if(!Number.isInteger(index)||index< -1||index>=225||(!moves.length&&index!==112))
     throw error('Invalid move. Black must play the center first.');
   const r=rules.legalMove(transcript.board,index,player,moves.length),
     n=native.legalMove(transcript.board,index,player,moves.length);
   if(!r.legal||!n.legal||r.win!==n.win)throw error('This move is illegal under the verified Renju rules.');
   moves.push({i:index,color:player,actor:'player'});
   let current=inspectMoves(moves);
   if(current.ended){status='completed';result=current.ended;}
   else{
     const response=selectBotMove(moves,row.bot_snapshot,Number(row.server_seed));
     moves.push(response);
     current=inspectMoves(moves);
     if(current.ended){status='completed';result=current.ended;}
   }
 }
 return {moves,status,result};
}
function publicRow(row:any){
 const info=inspectRow(row);
 return {id:row.id,mode:'verified-bot-training',rated:false,ratingDelta:null,
   ownerVerified:true,botId:row.bot_id,bot:row.bot_snapshot,rule:row.ruleset,
   playerColor:Number(row.player_color),moves:info.moves,revision:Number(row.revision),
   status:row.status,result:row.result||null,rating:publicMatchRating(row),startedAt:row.started_at,
   completedAt:row.completed_at||null,updatedAt:row.updated_at,
   integrity:{verifiedRules:true,transcriptSeal:row.transcript_sha256?
     'sha256-verified':'legacy-unsealed',serverAuthoritative:true},
   recovery:{canResume:row.status==='active',abandoned:row.status==='abandoned',
     idlePolicyDays:30,canRetrySettlement:row.rating_admission?.rated===true&&
       row.status!=='active'&&row.status!=='abandoned'&&!row.rating_settled_at}};
}
export async function handleBotMatchRequest(req:Request,parts:string[],services:Services):Promise<Response>{
 const {rest,verifiedAccount,readBody,enforceRequestLimit,json,fail,nowIso,q}=services;
 await enforceRequestLimit(req,'bot-match-'+req.method,80,300);
 const action=parts[2]||'';
 if(action==='catalog'&&req.method==='GET'&&parts.length===3)
   return json({ratedAvailable:false,policy:POLICY,bots:registry.BOTS.map((b:any)=>({
     id:b.id,label:b.label,ratingTarget:b.ratingTarget,ratingStatus:b.ratingStatus,ratedEnabled:false}))});
 const account=await verifiedAccount(req,true),owner=account.userId;
 const ownerPath='owner_user_id=eq.'+q(owner);
 // Owner-scoped idle recovery is database-atomic and only voids practice matches.
 // A rated admission never silently expires into an Elo-free escape.
 const expireIdle=async()=>rest('rpc/gomoku_bot_e6_expire_idle',{
   method:'POST',body:{p_owner:owner}});
 const present=async(row:any)=>{
   await verifyTranscriptHash(row);
   return publicRow(row);
 };
 const find=async (matchId:string)=>{
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&id=eq.'+q(matchId)+'&select=*');
   if(!Array.isArray(rows)||!rows[0])throw error('Bot match not found.',404);
   await verifyTranscriptHash(rows[0]);
   return rows[0];
 };
 if(req.method==='GET'&&action==='active'&&parts.length===3){
   await expireIdle();
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
   return json({match:Array.isArray(rows)&&rows[0]?await present(rows[0]):null,rated:false});
 }
 if(req.method==='GET'&&action==='history'&&parts.length===3){
   await expireIdle();
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&select=*&order=started_at.desc&limit=30');
   return json({matches:await Promise.all((Array.isArray(rows)?rows:[]).map(present)),rated:false});
 }
 if(req.method==='POST'&&!action&&parts.length===2){
   await expireIdle();
   const b=await readBody(req),key=token(b.requestId,VALID_KEY,'request identity');
   const level=bot(b.level),color=Number(b.color);
   if(color!==1&&color!==2)throw error('Choose Black or White.');
   // Request idempotency is owner-scoped. An existing active game is always resumed.
   const old=await rest('gomoku_bot_matches?'+ownerPath+'&request_key=eq.'+q(key)+'&select=*');
   if(Array.isArray(old)&&old[0])return json({match:await present(old[0]),reused:true});
   const active=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
   if(Array.isArray(active)&&active[0])return json({match:await present(active[0]),reused:true,reason:'active-match'});
   // The rating admission is server-generated BEFORE play, with no client input.
   // E4 is disabled until reviewed calibration and a distinct authorized activation.
   const admission=await prepareBotRatingAdmission(rest,owner,level.id);
   const serverSeed=seed(),snap=snapshot(level),moves:BotMove[]=[];
   if(color===2)moves.push(selectBotMove([],snap,serverSeed));
   const row={id:crypto.randomUUID(),owner_user_id:owner,request_key:key,ruleset:RULE,bot_id:level.id,
     bot_snapshot:snap,player_color:color,server_seed:serverSeed,moves,
     rating_admission:admission,
     revision:0,status:'active',result:null,completed_at:null};
   const createdRow={...row,transcript_sha256:await transcriptHash(row,moves)};
   try{
     const created=await rest('gomoku_bot_matches?select=*',{method:'POST',body:createdRow,prefer:'return=representation'});
     if(!Array.isArray(created)||!created[0])throw error('Bot match creation failed.',503);
     return json({match:await present(created[0]),reused:false},201);
   }catch(e){
     // Concurrent create: return the original owner-scoped session, never create a second one.
     const existing=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
     if(Array.isArray(existing)&&existing[0])return json({match:await present(existing[0]),reused:true,reason:'concurrent-start'});
     throw e;
   }
 }
 if(!VALID_UUID.test(action))return fail('Invalid bot match route.',404);
 const matchId=id(action);
 if(parts.length===3&&req.method==='GET'){
   await expireIdle();
   return json({match:await present(await find(matchId))});
 }
 // Recover a command receipt even if later moves happened. No client
 // decision, score or rating is ever reconstructed from request data.
 if(parts.length===5&&parts[3]==='commands'&&req.method==='GET'){
   const commandId=token(parts[4],VALID_COMMAND,'command identity');
   const [receipts,row]=await Promise.all([
     rest('gomoku_bot_match_commands?'+ownerPath+'&match_id=eq.'+q(matchId)+
       '&command_id=eq.'+q(commandId)+'&select=command_id,applied_revision'),
     find(matchId)
   ]);
   const hit=Array.isArray(receipts)?receipts[0]:null;
   return json({state:hit?'applied':'unknown',
     appliedRevision:hit?Number(hit.applied_revision):null,
     match:await present(row)});
 }
 if(parts.length===4&&parts[3]==='abandon'&&req.method==='POST'){
   const out=await rest('rpc/gomoku_bot_e6_abandon_practice',{
     method:'POST',body:{p_owner:owner,p_match:matchId}});
   if(!out?.match)throw error('Invalid verified practice abandonment response.',503);
   return json({status:out.status,match:await present(out.match),
     rated:false,awardedElo:false});
 }
 if(parts.length===4&&parts[3]==='action'&&req.method==='POST'){
   const b=await readBody(req),cmd=token(b.commandId,VALID_COMMAND,'command identity'),
     kind=String(b.action||'');
   if(kind!=='move'&&kind!=='resign')throw error('Only human moves and resignation are supported.',422);
   const row=await find(matchId);
   const clientRev=Number(b.revision);
   if(!Number.isSafeInteger(clientRev)||clientRev<0)
     throw error('Invalid match revision.',422);
   const commandHash=await commandFingerprint(owner,matchId,cmd,clientRev,kind,
     kind==='move'?Number(b.i):null);
   // Fast prior-receipt lookup avoids re-running a time-budgeted bot search on
   // acknowledged commands. The database RPC is still the final atomic authority.
   const prior=await rest('gomoku_bot_match_commands?'+ownerPath+
     '&match_id=eq.'+q(matchId)+'&command_id=eq.'+q(cmd)+
     '&select=request_sha256,applied_revision');
   if(Array.isArray(prior)&&prior[0]){
     if(prior[0].request_sha256!==commandHash)
       return json({status:'command-mismatch',match:await present(row)},409);
     return json({status:'already-applied',match:await present(row),
       appliedRevision:Number(prior[0].applied_revision),reused:true});
   }
   if(clientRev!==Number(row.revision)||row.status!=='active')
     return json({status:'conflict',match:await present(row)},409);
   const next=applyHumanMove(row,Number(b.i),kind),closed=next.status!=='active';
   const now=closed?nowIso():null;
   const transcriptSeal=await transcriptHash(row,next.moves);
   const receipt=validateReceipt(await rest('rpc/gomoku_bot_e6_commit_action',{
     method:'POST',body:{
       p_owner:owner,p_match:matchId,p_command:cmd,p_request_hash:commandHash,
       p_revision:clientRev,p_action:kind,p_moves:next.moves,
       p_status:next.status,p_result:next.result,p_digest:transcriptSeal,
       p_completed_at:now
     }
   }));
   const authoritative=receipt.match;
   if(receipt.status==='conflict'||receipt.status==='command-mismatch')
     return json({status:receipt.status,match:await present(authoritative)},409);
   let settlement:any=null;
   // This is a genuine terminal server transcript; only the E4 DB RPC may
   // award Elo. A request replay returns the already-verified current state.
   if(authoritative.status==='completed'||authoritative.status==='resigned'){
     try{
       settlement=await settleBotRatingMatch(rest,owner,matchId);
     }catch(e){settlement={status:'retry-required',settled:false};}
   }
   return json({status:receipt.status,match:await present(authoritative),
     appliedRevision:Number(receipt.appliedRevision),reused:receipt.status==='already-applied',
     ...(settlement?{settlement}:{})});
 }
 return fail('Bot match route not found.',404);
}
