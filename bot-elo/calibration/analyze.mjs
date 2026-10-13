/**
 * E3 evidence analysis: independent structural validation, regularized
 * Bradley–Terry scores with Black advantage, paired-opening bootstrap CIs.
 *
 * Inputs are actual tournament evidence; NEVER generated or substituted here.
 * Ratings are anchored arbitrarily (Tactical=1400), not human Elo.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import '../rating.js';
import {plan,fingerprint,replayEvidence} from './run-tournament.mjs';
import {nativeSearchConfig,POLICY_ID,RULE} from './e2-policy.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const REG=globalThis.GomokuBotEloE1,IDS=REG.BOTS.map(x=>x.id),ANCHOR='mid';
const METHOD='gomoku-bot-calibration-fit/1.0.0',SLOPE=Math.log(10)/400;
const ANCHOR_RATING=1400,PRIOR_SD=550,COLOR_PRIOR_SD=250;
const index=new Map(IDS.filter(x=>x!==ANCHOR).map((x,i)=>[x,i]));
const DIM=IDS.length; // 7 free bot ratings, one global Black advantage
const colorIndex=DIM-1;
const sha=x=>createHash('sha256').update(x).digest('hex');
function assert(ok,why){if(!ok)throw Error('Evidence rejected: '+why);}
function seeded(seed){let s=seed>>>0||0x9e3779b9;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
function invertSolve(matrix,rhs){
 const n=rhs.length,a=matrix.map((r,i)=>[...r,rhs[i]]);
 for(let c=0;c<n;c++){
   let pivot=c;
   for(let r=c+1;r<n;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;
   if(Math.abs(a[pivot][c])<1e-12)throw Error('Calibration design is singular.');
   [a[c],a[pivot]]=[a[pivot],a[c]];
   const v=a[c][c];for(let j=c;j<=n;j++)a[c][j]/=v;
   for(let r=0;r<n;r++)if(r!==c){const factor=a[r][c];for(let j=c;j<=n;j++)a[r][j]-=factor*a[c][j];}
 }
 return a.map(r=>r[n]);
}
function features(game){
 const x=Array(DIM).fill(0);
 if(index.has(game.black))x[index.get(game.black)]+=1;
 if(index.has(game.white))x[index.get(game.white)]-=1;
 x[colorIndex]=1;
 return x;
}
function sufficient(games,theta){
 const gram=Array.from({length:DIM},()=>Array(DIM).fill(0)),grad=Array(DIM).fill(0);
 // Independent zero-centered Gaussian regularization around the arbitrary ladder anchor.
 for(let j=0;j<DIM;j++){
   const precision=1/(j===colorIndex?COLOR_PRIOR_SD:PRIOR_SD)**2;
   gram[j][j]+=precision;grad[j]-=precision*theta[j];
 }
 let logLik=0;
 for(const game of games){
   const x=features(game),z=SLOPE*x.reduce((a,v,j)=>a+v*theta[j],0),
     p=1/(1+Math.exp(-Math.max(-35,Math.min(35,z)))),
     w=SLOPE*SLOPE*p*(1-p),diff=SLOPE*(game.score-p);
   logLik+=game.score*Math.log(p)+(1-game.score)*Math.log(1-p);
   for(let j=0;j<DIM;j++){
     grad[j]+=diff*x[j];
     for(let k=0;k<DIM;k++)gram[j][k]+=w*x[j]*x[k];
   }
 }
 return {gram,grad,logLik};
}
export function fit(games){
 if(!Array.isArray(games))throw TypeError('Missing observed games');
 let theta=Array(DIM).fill(0),iterations=0;
 for(let round=0;round<120;round++){
   const {gram,grad}=sufficient(games,theta),step=invertSolve(gram,grad);
   let max=0;
   for(let i=0;i<DIM;i++){
     // Cap Newton steps on near-separated sparse comparisons.
     const d=Math.max(-180,Math.min(180,step[i]));
     theta[i]+=d;max=Math.max(max,Math.abs(d));
   }
   iterations=round+1;if(max<0.00001)break;
 }
 const {gram}=sufficient(games,theta);
 const variance=Array.from({length:DIM},(_,i)=>Math.max(0,invertSolve(gram,Array.from({length:DIM},(_,j)=>i===j?1:0))[i]));
 const ratings=Object.fromEntries(IDS.map(id=>[id,ANCHOR_RATING+(index.has(id)?theta[index.get(id)]:0)]));
 const sd=Object.fromEntries(IDS.map(id=>[id,index.has(id)?Math.sqrt(variance[index.get(id)]):0]));
 return {ratings,sd,blackAdvantage:theta[colorIndex],blackAdvantageSD:Math.sqrt(variance[colorIndex]),iterations};
}
function percentile(arr,p){
 if(!arr.length)return null;
 const a=arr.slice().sort((x,y)=>x-y),v=(a.length-1)*p,i=Math.floor(v),j=Math.ceil(v);
 return a[i]+(a[j]-a[i])*(v-i);
}
function bootstrap(games,replicates,seed){
 if(!games.length)return null;
 const groups=new Map();
 for(const g of games){if(!groups.has(g.group))groups.set(g.group,[]);groups.get(g.group).push(g);}
 const blocks=[...groups.values()],random=seeded(seed),draws=Object.fromEntries(IDS.map(id=>[id,[]])),colors=[];
 for(let rep=0;rep<replicates;rep++){
   const sampled=[];
   for(let i=0;i<blocks.length;i++){const group=blocks[Math.floor(random()*blocks.length)];sampled.push(...group);}
   const value=fit(sampled);
   for(const id of IDS)draws[id].push(value.ratings[id]);
   colors.push(value.blackAdvantage);
 }
 return {ratings:Object.fromEntries(IDS.map(id=>[id,{low:percentile(draws[id],.025),high:percentile(draws[id],.975)}])),
   color:{low:percentile(colors,.025),high:percentile(colors,.975)}};
}
function approx(v){return Math.round(v*10)/10;}
function normalizeGame(raw,scenario){
 assert(raw.id===scenario.id,'scenario id mismatch');
 assert(raw.policy===POLICY_ID&&raw.ruleset===RULE,'policy or ruleset mismatch');
 assert(raw.bots?.black===scenario.black&&raw.bots?.white===scenario.white,'bot color identity mismatch');
 assert(raw.seed===scenario.serverSeed,'server seed mismatch');
 assert(JSON.stringify(raw.opening)===JSON.stringify(scenario.prefix),'opening policy mismatch');
 const moves=raw.moves;assert(Array.isArray(moves),'missing moves');
 assert(moves.length>=scenario.prefix.length,'shorter than opening');
 for(let i=0;i<scenario.prefix.length;i++)
   assert(JSON.stringify(moves[i])===JSON.stringify(scenario.prefix[i]),'opening prefix mismatch');
 for(let p=scenario.prefix.length;p<moves.length;p++){
   const m=moves[p],botId=m.color===1?scenario.black:scenario.white;
   const seed=nativeSearchConfig({
     id:botId,policy:POLICY_ID,policyVersion:'e2.1',
     nativeBudget:REG.getBot(botId).nativeBudget,
     searchBudgetMs:Math.min(1000,REG.getBot(botId).nativeBudget.timeMs)
   },scenario.serverSeed,p).seed;
   assert(m.botId===botId&&m.source==='native-e2'&&
     m.decision?.policy===POLICY_ID&&m.decision?.seed===seed,'bot decision provenance mismatch');
 }
 const info=replayEvidence(moves);
 assert(!!info.ended,'unfinished evidence game');
 assert(info.ended.winner===raw.result?.winner&&info.ended.reason===raw.result?.reason,
   'result inconsistent with verified transcript');
 return {id:raw.id,group:scenario.group,black:scenario.black,white:scenario.white,
   score:info.ended.winner===0?0.5:info.ended.winner===1?1:0,
   plies:moves.length,openingPly:scenario.prefix.length};
}
export async function readEvidence(path){
 const text=await readFile(path,'utf8'),lines=text.split(/\r?\n/).filter(Boolean);
 assert(lines.length>0,'no observed matches; refusing to invent results');
 const first=JSON.parse(lines[0]),seed=Number(first.seed),experimentId=first.experimentId;
 // Experiment seed belongs to a campaign, but per-game seed is different.
 const manifest=first.source;
 const current=await fingerprint();
 assert(JSON.stringify(manifest)===JSON.stringify(current),'source revision/hash mismatch; start a new experiment');
 assert(typeof experimentId==='string'&&/^[a-f0-9]{64}$/.test(experimentId),'invalid campaign id');
 return {lines,experimentId,source:manifest};
}
export async function analyze(path,{openings=16,seed=20261013,replicates=120}={}){
 if(!Number.isInteger(replicates)||replicates<20||replicates>800)throw Error('Invalid bootstrap size');
 const raw=await readFile(path,'utf8');
 const lines=raw.split(/\r?\n/).filter(Boolean);
 assert(lines.length>0,'no observed matches; refusing to publish empty calibration');
 const source=await fingerprint();
 const spec={schema:'gomoku-bot-calibration-tournament/1.0.0',seed,openings,source,policy:POLICY_ID,rule:RULE};
 const experimentId=sha(JSON.stringify(spec)),schedule=plan({seed,openings}),lookup=new Map(schedule.map(x=>[x.id,x])),seen=new Set();
 const verified=[];
 for(const line of lines){
   const row=JSON.parse(line);
   assert(row.experimentId===experimentId,'experiment ID does not match exact source and schedule');
   assert(row.schema===spec.schema&&JSON.stringify(row.source)===JSON.stringify(source),'evidence source mismatch');
   assert(!seen.has(row.id),'duplicate recorded game');
   seen.add(row.id);
   const scenario=lookup.get(row.id);assert(!!scenario,'unscheduled match');
   verified.push(normalizeGame(row,scenario));
 }
 const byGroup=new Map();
 for(const game of verified){if(!byGroup.has(game.group))byGroup.set(game.group,[]);byGroup.get(game.group).push(game);}
 const balanced=[...byGroup.values()].filter(g=>g.length===2&&
     g[0].black===g[1].white&&g[0].white===g[1].black).flat();
 const discarded=verified.length-balanced.length,model=fit(balanced),
   bounds=bootstrap(balanced,replicates,seed^0xbeef1)||
     {ratings:Object.fromEntries(IDS.map(id=>[id,{low:null,high:null}])),color:{low:null,high:null}};
 const stats=Object.fromEntries(IDS.map(id=>[id,{games:0,wins:0,draws:0,losses:0,
   black:0,white:0,opponents:new Set(),openings:new Set(),points:0}]));
 for(const g of balanced){
   for(const [id,color,outcome] of [[g.black,'black',g.score],[g.white,'white',1-g.score]]){
     const st=stats[id];st.games++;st[color]++;st.points+=outcome;
     if(outcome===1)st.wins++;else if(outcome===0.5)st.draws++;else st.losses++;
     st.opponents.add(id===g.black?g.white:g.black);st.openings.add(g.group);
   }
 }
 const botReports=IDS.map(id=>{
   const s=stats[id],lo=bounds.ratings[id].low,hi=bounds.ratings[id].high,
     se=model.sd[id],approxWidth=1.96*se;
   const low=lo===null?null:Math.min(lo,model.ratings[id]-approxWidth),
     high=hi===null?null:Math.max(hi,model.ratings[id]+approxWidth);
   const sufficient=s.games>=80&&s.black>=25&&s.white>=25&&s.opponents.size>=3&&
     s.openings.size>=24&&(high-low)<=360;
   return {
     id,displayName:REG.getBot(id).label,measuredFromGames:s.games,
     record:{wins:s.wins,draws:s.draws,losses:s.losses,black:s.black,white:s.white},
     distinctOpponents:s.opponents.size,distinctMatchedOpenings:s.openings.size,
     averageScore:s.games?approx(s.points/s.games):null,
     candidateRelativeRating:approx(model.ratings[id]),
     confidence95:low===null?null:{low:approx(low),high:approx(high)},
     status:sufficient?'review-candidate':'provisional-insufficient-evidence',
     ratedEnabled:false,reason:sufficient?
       'Thresholds met; independent review and versioned approval still required.':
       'Insufficient observations, color balance, opponent coverage, opening diversity or precision.'
   };
 });
 const complete=seen.size===schedule.length;
 return {
   schema:'gomoku-calibration-report/1.0.0',method:METHOD,experimentId,
   sourceFingerprints:source,rule:RULE,policy:POLICY_ID,
   reference:{bot:ANCHOR,rating:ANCHOR_RATING,
     explanation:'Arbitrary internal scale anchor. Not comparable to FIDE, human PvP or real-world Elo.'},
   sampling:{scheduledGames:schedule.length,recordedGames:verified.length,
     pairedGames:balanced.length,incompleteGroupGames:discarded,
     completedMatchedPairs:balanced.length/2,complete,
     nBootstrap:balanced.length?replicates:0},
   blackAdvantageElo:approx(model.blackAdvantage),
   blackAdvantage95:bounds.color.low===null?null:{
     low:approx(Math.min(bounds.color.low,model.blackAdvantage-1.96*model.blackAdvantageSD)),
     high:approx(Math.max(bounds.color.high,model.blackAdvantage+1.96*model.blackAdvantageSD))},
   bots:botReports,rankedEnabled:false,
   candidateReviewable:complete&&botReports.every(x=>x.status==='review-candidate'),
   limitations:[
     'Search is time-budgeted: scenario seeds are repeatable, native moves may differ by hardware.',
     'Opening template games are controlled artificial positions, not real human opening frequency.',
     'Bradley–Terry quasi-likelihood treats draws as half a win; color effect is estimated globally.',
     'Regularized fit, paired resampling and heuristic acceptance thresholds do not establish absolute Elo.',
     'Structural transcript verification is not an independent proof of every original search decision.',
     'Human review and explicit versioned approval required; no automatic replacement of E1 design targets.'
   ]
 };
}
function cli(argv){
 const a=new Map();
 for(let i=0;i<argv.length;i++){
   const k=argv[i];if(!['--in','--out','--openings','--seed','--bootstrap'].includes(k)||!argv[i+1])throw Error('Unknown report argument '+k);
   a.set(k,argv[++i]);
 }
 if(!a.has('--in'))throw Error('--in evidence.jsonl is required');
 return {input:resolve(a.get('--in')),output:resolve(a.get('--out')||'bot-elo/calibration/local-evidence/e3-report.json'),
   openings:Number(a.get('--openings')||16),seed:Number(a.get('--seed')||20261013),
   replicates:Number(a.get('--bootstrap')||120)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const c=cli(process.argv.slice(2));
 analyze(c.input,{openings:c.openings,seed:c.seed,replicates:c.replicates})
 .then(async report=>{await mkdir(dirname(c.output),{recursive:true});
   await writeFile(c.output,JSON.stringify(report,null,2)+'\n');
   console.log('Evidence-based report written:',c.output,
     'paired games:',report.sampling.pairedGames,
     'review candidates:',report.bots.filter(x=>x.status==='review-candidate').length);
 })
 .catch(e=>{console.error(e.message);process.exitCode=1;});
}
