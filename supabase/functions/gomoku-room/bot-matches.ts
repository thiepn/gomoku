/* E2: real owner-authenticated bot game custody. NO rating settlement.
 * Uses original Studio search mirrored from script#rules-engine and existing server rules.
 * Bot decisions are made only here; the browser submits only human moves.
 */
import '../../../bot-elo/rating.js';
import { createNativeBotEngine } from './native-bot-engine.js';
import { createEngine } from './rules.js';
import { prepareBotRatingAdmission, settleBotRatingMatch, publicMatchRating } from './bot-rating.ts';
import { POLICY_ID, snapshotForLevel, choosePinnedMove } from '../../../bot-elo/calibration/e2-policy.mjs';

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
 if(row.status==='completed'&&JSON.stringify(row.result)!==JSON.stringify(info.ended))
   throw error('Completed bot result integrity mismatch.',500);
 if(row.status==='resigned'&&(!row.result||row.result.reason!=='resign'||Number(row.result.winner)!==3-Number(row.player_color)||info.ended))
   throw error('Resigned bot result integrity mismatch.',500);
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
   completedAt:row.completed_at||null,updatedAt:row.updated_at};
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
 const find=async (matchId:string)=>{
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&id=eq.'+q(matchId)+'&select=*');
   if(!Array.isArray(rows)||!rows[0])throw error('Bot match not found.',404);
   return rows[0];
 };
 if(req.method==='GET'&&action==='active'&&parts.length===3){
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
   return json({match:Array.isArray(rows)&&rows[0]?publicRow(rows[0]):null,rated:false});
 }
 if(req.method==='GET'&&action==='history'&&parts.length===3){
   const rows=await rest('gomoku_bot_matches?'+ownerPath+'&select=*&order=started_at.desc&limit=30');
   return json({matches:(Array.isArray(rows)?rows:[]).map(publicRow),rated:false});
 }
 if(req.method==='POST'&&!action&&parts.length===2){
   const b=await readBody(req),key=token(b.requestId,VALID_KEY,'request identity');
   const level=bot(b.level),color=Number(b.color);
   if(color!==1&&color!==2)throw error('Choose Black or White.');
   // Request idempotency is owner-scoped. An existing active game is always resumed.
   const old=await rest('gomoku_bot_matches?'+ownerPath+'&request_key=eq.'+q(key)+'&select=*');
   if(Array.isArray(old)&&old[0])return json({match:publicRow(old[0]),reused:true});
   const active=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
   if(Array.isArray(active)&&active[0])return json({match:publicRow(active[0]),reused:true,reason:'active-match'});
   // The rating admission is server-generated BEFORE play, with no client input.
   // E4 is disabled until reviewed calibration and a distinct authorized activation.
   const admission=await prepareBotRatingAdmission(rest,owner,level.id);
   const serverSeed=seed(),snap=snapshot(level),moves:BotMove[]=[];
   if(color===2)moves.push(selectBotMove([],snap,serverSeed));
   const row={owner_user_id:owner,request_key:key,ruleset:RULE,bot_id:level.id,
     bot_snapshot:snap,player_color:color,server_seed:serverSeed,moves,
     rating_admission:admission,
     revision:0,status:'active',result:null,completed_at:null};
   try{
     const created=await rest('gomoku_bot_matches?select=*',{method:'POST',body:row,prefer:'return=representation'});
     if(!Array.isArray(created)||!created[0])throw error('Bot match creation failed.',503);
     return json({match:publicRow(created[0]),reused:false},201);
   }catch(e){
     // Concurrent create: return the original owner-scoped session, never create a second one.
     const existing=await rest('gomoku_bot_matches?'+ownerPath+'&status=eq.active&select=*');
     if(Array.isArray(existing)&&existing[0])return json({match:publicRow(existing[0]),reused:true,reason:'concurrent-start'});
     throw e;
   }
 }
 if(!VALID_UUID.test(action))return fail('Invalid bot match route.',404);
 const matchId=id(action);
 if(parts.length===3&&req.method==='GET')return json({match:publicRow(await find(matchId))});
 if(parts.length===4&&parts[3]==='action'&&req.method==='POST'){
   const b=await readBody(req),cmd=token(b.commandId,VALID_COMMAND,'command identity'),
     kind=String(b.action||'');
   if(kind!=='move'&&kind!=='resign')throw error('Only human moves and resignation are supported.',422);
   const row=await find(matchId);
   if(row.last_command_id===cmd)return json({match:publicRow(row),reused:true});
   const clientRev=Number(b.revision);
   if(!Number.isSafeInteger(clientRev)||clientRev!==Number(row.revision))throw error('Match changed. Refresh before retrying.',409);
   const next=applyHumanMove(row,Number(b.i),kind),closed=next.status!=='active';
   const patch={moves:next.moves,status:next.status,result:next.result,
     revision:clientRev+1,last_command_id:cmd,updated_at:nowIso(),
     completed_at:closed?nowIso():null};
   const updated=await rest('gomoku_bot_matches?'+ownerPath+'&id=eq.'+q(matchId)+
     '&revision=eq.'+clientRev+'&status=eq.active&select=*',{
       method:'PATCH',body:patch,prefer:'return=representation'});
   if(!Array.isArray(updated)||!updated[0])throw error('Another move completed first. Refresh the match.',409);
   let authoritative=updated[0],settlement:any=null;
   if(closed){
     try{
       // PostgreSQL rechecks trusted completed match, account ownership and frozen admission.
       // One transaction + UNIQUE(match_id) ensures exact-once rewards if later activated.
       settlement=await settleBotRatingMatch(rest,owner,matchId);
       const latest=await find(matchId);authoritative=latest;
     }catch(e){
       // Preserve the finished game. Caller receives an explicit recovery warning;
       // no client-generated rating or ad-hoc second settlement is possible.
       settlement={status:'retry-required',settled:false};
     }
   }
   return json({match:publicRow(authoritative),reused:false,
     ...(settlement?{settlement}:{} )});
 }
 return fail('Bot match route not found.',404);
}
