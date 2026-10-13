/**
 * Gomoku E3 calibration tournament. Explicit manual CLI, not a CI/test runner.
 * Source-identical original Studio AI; E2 configuration comes from e2-policy.mjs.
 * No network calls, account data, Elo writes, or synthetic reported results.
 *
 * node bot-elo/calibration/run-tournament.mjs --out /tmp/gomoku-e3.jsonl --openings 16 --max-games 12
 * Repeat same invocation to resume the precomputed schedule. --all opts in to all remaining games.
 * A deterministic schedule is NOT a promise of deterministic moves: native search is time-budgeted.
 */
import {readFile,appendFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import '../rating.js';
import {createNativeBotEngine} from '../../supabase/functions/gomoku-room/native-bot-engine.js';
import {createEngine as createOnlineRules} from '../../supabase/functions/gomoku-room/rules.js';
import {choosePinnedMove,snapshotForLevel,POLICY_ID,RULE} from './e2-policy.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const REG=globalThis.GomokuBotEloE1;
const BOT_IDS=REG.BOTS.map(x=>x.id);
const VERSION='gomoku-bot-calibration-tournament/1.0.0';
const native=createNativeBotEngine(RULE),rules=createOnlineRules(RULE);
const sum=s=>createHash('sha256').update(s).digest('hex');
function rng(seed){let x=(seed>>>0)||0x9e3779b9;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function number(raw,label,min,max){const n=Number(raw);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid '+label);return n;}
function options(argv){
 const flags=new Map();
 for(let i=0;i<argv.length;i++){
   const a=argv[i];if(a==='--all'){flags.set('all',true);continue;}
   if(!['--out','--openings','--seed','--max-games'].includes(a)||!argv[i+1])throw Error('Unknown/incomplete option '+a);
   if(flags.has(a))throw Error('Duplicate option '+a);
   flags.set(a,argv[++i]);
 }
 return Object.freeze({
   out:resolve(String(flags.get('--out')||'bot-elo/calibration/local-evidence/e3-games.jsonl')),
   seed:number(flags.get('--seed')||20261013,'seed',1,0xffffffff),
   openings:number(flags.get('--openings')||16,'openings per pairing',2,256),
   maxGames:flags.has('all')?Infinity:number(flags.get('--max-games')||8,'max games this run',1,1000)
 });
}
export async function fingerprint(){
 const files={
   search:'supabase/functions/gomoku-room/native-bot-engine.js',
   rules:'supabase/functions/gomoku-room/rules.js',
   policy:'bot-elo/calibration/e2-policy.mjs',
   registry:'bot-elo/rating.js',
   runner:'bot-elo/calibration/run-tournament.mjs'
 };
 const out={};
 for(const [k,path] of Object.entries(files))out[k]=sum(await readFile(resolve(ROOT,path)));
 return Object.freeze(out);
}
export function opening(seed,index){
 if(index%4===0)return [];
 const rand=rng((seed^(index*0x9e3779b9))>>>0),board=new Int8Array(225),moves=[];
 const positionCount=index%4===1?1:index%4===2?3:5;
 for(let p=0;p<positionCount;p++){
   let options=[];
   if(p===0)options=[112];
   else{
     for(let i=0;i<225;i++){
       if(board[i]||Math.abs(i%15-7)>4||Math.abs(Math.floor(i/15)-7)>4)continue;
       const l=rules.legalMove(board,i,p%2+1,p);
       if(l.legal&&!l.win)options.push(i);
     }
     // Avoid wildly separated and instantly forced positions; seeded variety within native Renju legality.
     options=options.filter(i=>Math.abs(i%15-7)+Math.abs(Math.floor(i/15)-7)<=5);
   }
   if(!options.length)throw Error('Opening generator exhausted legal moves');
   const i=options[Math.floor(rand()*options.length)],color=p%2+1;
   const legal=rules.legalMove(board,i,color,p),n=native.legalMove(board,i,color,p);
   if(!legal.legal||!n.legal||legal.win||n.win)throw Error('Invalid opening');
   board[i]=color;moves.push({i,color,source:'opening'});
 }
 return moves;
}
export function plan(config){
 const games=[];
 for(let a=0;a<BOT_IDS.length;a++)for(let b=a+1;b<BOT_IDS.length;b++){
   for(let o=0;o<config.openings;o++){
     const group=[BOT_IDS[a],BOT_IDS[b],o];
     const prefix=opening(config.seed^Math.imul((a+1)*29+(b+1),0x45d9f3b),o);
     const seed=(config.seed^Math.imul((a+1)*131+(b+1)*17+(o+1),0x9e3779b1))>>>0;
     for(let flip=0;flip<2;flip++){
       const black=BOT_IDS[flip?b:a],white=BOT_IDS[flip?a:b];
       const id=['e3',a,b,o,flip].join('-');
       games.push({id,group:group.join(':'),black,white,prefix,serverSeed:seed});
     }
   }
 }
 return games;
}
function progress(board,moves,consecutivePasses){
 const ply=moves.length,color=ply%2+1;
 return {ply,color,consecutivePasses};
}
function terminal(moves){
 const board=new Int8Array(225);let passes=0,stones=0,ended=null;
 for(let p=0;p<moves.length;p++){
   const m=moves[p],color=p%2+1;
   if(m.color!==color||!Number.isInteger(m.i)||m.i< -1||m.i>=225||ended)
     throw Error('Malformed evidence transcript');
   if(m.i===-1){
     if(p<3||!native.legalMove(board,-1,color,p).legal||
         !rules.legalMove(board,-1,color,p).legal)throw Error('Invalid recorded pass');
     passes++;
   }else{
     const a=rules.legalMove(board,m.i,color,p),b=native.legalMove(board,m.i,color,p);
     if(board[m.i]||!a.legal||!b.legal||a.win!==b.win||(p===0&&m.i!==112))
       throw Error('Illegal move or inconsistent original/server rules');
     board[m.i]=color;stones++;passes=0;
     if(a.win)ended={winner:color,reason:'five'};
   }
   if(!ended&&passes>=2)ended={winner:0,reason:'passes'};
   if(!ended&&stones>=225)ended={winner:0,reason:'full'};
 }
 return {board,ended,stones,passes};
}
export function replayEvidence(moves){
 if(!Array.isArray(moves)||moves.length>227)throw Error('Invalid transcript length');
 return terminal(moves);
}
async function play(scenario,source,experimentId){
 let moves=scenario.prefix.map(m=>({...m})),info=terminal(moves);
 let moveBudget=0,uncertainDecisions=0;
 const snapshots=Object.fromEntries([scenario.black,scenario.white].map(id=>[id,snapshotForLevel(REG.getBot(id))]));
 while(!info.ended){
   const color=moves.length%2+1,actor=color===1?scenario.black:scenario.white;
   const {decision,config}=choosePinnedMove(native,info.board,color,snapshots[actor],scenario.serverSeed,moves.length);
   const i=decision.move,check=rules.legalMove(info.board,i,color,moves.length);
   if(!check.legal||(moves.length===0&&i!==112))throw Error('Unverified E2 decision');
   moves.push({i,color,source:'native-e2',botId:actor,decision:{
     reason:String(decision.reason||''),depth:Number(decision.depth)||0,
     nodes:Number(decision.nodes)||0,elapsedMs:Number(decision.elapsedMs)||0,
     seed:config.seed,policy:POLICY_ID
   }});
   moveBudget+=config.timeMs;
   if(Number(decision.elapsedMs)>=config.timeMs)uncertainDecisions++;
   info=terminal(moves);
   if(moves.length>227)throw Error('Tournament exceeded legal transcript bound');
 }
 return {
   schema:VERSION,experimentId,id:scenario.id,openingGroup:scenario.group,
   bots:{black:scenario.black,white:scenario.white},opening:scenario.prefix,
   seed:scenario.serverSeed,ruleset:RULE,policy:POLICY_ID,source,
   moves,result:info.ended,search:{plannedBudgetMs:moveBudget,timeCappedDecisions:uncertainDecisions},
   note:'Original time-budgeted native policy; transcript is verified, exact choice is not cross-machine reproducible.'
 };
}
async function main(){
 if(!REG?.BOTS||REG.BOTS.length!==8)throw Error('E1 registry mismatch');
 const cfg=options(process.argv.slice(2)),source=await fingerprint();
 const campaign={schema:VERSION,seed:cfg.seed,openings:cfg.openings,source,policy:POLICY_ID,rule:RULE};
 const experimentId=sum(JSON.stringify(campaign)),schedule=plan(cfg);
 let previous='';try{previous=await readFile(cfg.out,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 const completed=new Set();
 for(const line of previous.split(/\r?\n/).filter(Boolean)){
   const row=JSON.parse(line);
   if(row.experimentId!==experimentId||row.schema!==VERSION||
      JSON.stringify(row.source)!==JSON.stringify(source))
     throw Error('Existing evidence belongs to a different experiment or source revision');
   if(completed.has(row.id))throw Error('Duplicate evidence match ID');
   completed.add(row.id);
 }
 await mkdir(dirname(cfg.out),{recursive:true});
 let written=0;
 for(const scenario of schedule){
   if(completed.has(scenario.id))continue;
   if(written>=cfg.maxGames)break;
   const result=await play(scenario,source,experimentId);
   await appendFile(cfg.out,JSON.stringify(result)+'\n','utf8');
   written++;
   process.stdout.write('Recorded '+scenario.id+' / '+result.result.reason+' / winner '+result.result.winner+'\n');
 }
 process.stdout.write(JSON.stringify({experimentId,source,schedule:schedule.length,
   prior:completed.size,newMatches:written,remaining:schedule.length-completed.size-written,
   output:cfg.out,notice:'No Elo ratings assigned. This is unverified local calibration evidence.'},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
