/**
 * E3 safe assignment gate. Produces optional review-approved, immutable
 * calibration *artifacts*, never overwrites E1 ratings or enables live rated play.
 *
 * Manual review requires full source-consistent evidence, sufficient paired
 * observations, a named reviewer, a reason and explicit approval flags.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import '../rating.js';
import {analyze} from './analyze.mjs';
import {POLICY_ID,RULE} from './e2-policy.mjs';

const ASSIGNMENT_VERSION='gomoku-bot-calibration-assignment/1.0.0';
const BOT_IDS=globalThis.GomokuBotEloE1.BOTS.map(x=>x.id);
const sum=b=>createHash('sha256').update(b).digest('hex');
function demand(ok,s){if(!ok)throw Error('Calibration promotion blocked: '+s);}
export function resolveAssignments(assignment){
 const E=globalThis.GomokuBotEloE1;
 const fallback=E.BOTS.map(b=>Object.freeze({
   id:b.id,label:b.label,targetElo:b.ratingTarget,
   calibrationStatus:'uncalibrated-provisional',ratingUncertainty:null,
   policy:POLICY_ID,ratedEnabled:false
 }));
 if(!assignment)return Object.freeze({source:'e1-provisional',bots:fallback,
   ratedEnabled:false,notice:'Unmeasured E1 numbers are illustrative only.'});
 demand(assignment.schema===ASSIGNMENT_VERSION,'unknown assignment schema');
 demand(assignment.policy===POLICY_ID&&assignment.ruleset===RULE,'mismatched policy or ruleset');
 demand(assignment.ratedEnabled===false,'assignment must not activate ranked play');
 demand(assignment.review?.approved===true&&
   typeof assignment.review.reviewer==='string'&&assignment.review.reviewer.length>=3&&
   typeof assignment.review.rationale==='string'&&assignment.review.rationale.length>=80,
   'documented independent review missing');
 demand(/^[a-z][a-z0-9_.-]{2,63}$/.test(assignment.releaseId||''),'invalid release id');
 demand(typeof assignment.evidenceSha256==='string'&&/^[0-9a-f]{64}$/.test(assignment.evidenceSha256),
   'missing evidence digest');
 demand(assignment.calibration?.complete===true,'incomplete experiment');
 demand(Array.isArray(assignment.bots)&&assignment.bots.length===BOT_IDS.length,'expected exact bot coverage');
 const seen=new Set();
 const bots=assignment.bots.map((entry,i)=>{
   demand(entry.id===BOT_IDS[i]&&!seen.has(entry.id),'bot order/identity mismatch');seen.add(entry.id);
   demand(Number.isFinite(entry.estimatedElo)&&entry.estimatedElo>=400&&entry.estimatedElo<=6000,
     'invalid reviewed rating');
   demand(entry.confidence95&&Number.isFinite(entry.confidence95.low)&&
     Number.isFinite(entry.confidence95.high)&&entry.confidence95.low<=entry.estimatedElo&&
     entry.confidence95.high>=entry.estimatedElo,'unjustified rating precision');
   demand(entry.calibrationStatus==='reviewed-calibrated'&&entry.ratedEnabled===false,
     'calibration approval must not activate rating');
   return Object.freeze({id:entry.id,label:E.getBot(entry.id).label,
     targetElo:entry.estimatedElo,calibrationStatus:entry.calibrationStatus,
     ratingUncertainty:(entry.confidence95.high-entry.confidence95.low)/2,
     confidence95:Object.freeze({...entry.confidence95}),policy:POLICY_ID,ratedEnabled:false});
 });
 return Object.freeze({source:assignment.releaseId,policy:POLICY_ID,bots:Object.freeze(bots),
   ratedEnabled:false,notice:'Reviewed calibration data, NOT an authorization to award Elo.'});
}
function argumentsFor(argv){
 const flags=new Map();
 for(let i=0;i<argv.length;i++){
   const s=argv[i];
   if(s==='--approve-reviewed'||s==='--accept-relative-anchor'){flags.set(s,true);continue;}
   if(!['--evidence','--out','--release','--reviewer','--review-note','--openings','--seed','--bootstrap'].includes(s)||
      !argv[i+1])throw Error('Invalid assignment argument '+s);
   flags.set(s,argv[++i]);
 }
 return flags;
}
export async function stageReviewAssignment({
 evidence,openings=16,seed=20261013,bootstrap=120,releaseId,reviewer,rationale,
 approvedReviewed=false,acceptRelativeAnchor=false
}){
 demand(approvedReviewed===true&&acceptRelativeAnchor===true,
   'explicit review and arbitrary-rating-anchor acknowledgments required');
 demand(typeof reviewer==='string'&&reviewer.trim().length>=3,'reviewer identity is required');
 demand(typeof rationale==='string'&&rationale.trim().length>=80,'substantive reviewer rationale is required');
 demand(typeof releaseId==='string'&&/^[a-z][a-z0-9_.-]{2,63}$/.test(releaseId),'invalid release id');
 const evidenceBytes=await readFile(evidence);
 const report=await analyze(evidence,{openings,seed,replicates:bootstrap});
 demand(report.candidateReviewable===true,'coverage, color balance, or uncertainty gates not met');
 demand(report.sampling.complete===true&&report.sampling.incompleteGroupGames===0,'unpaired evidence');
 const estimates=report.bots.map(b=>{
   demand(b.status==='review-candidate'&&b.confidence95,'insufficient bot evidence: '+b.id);
   return {id:b.id,estimatedElo:b.candidateRelativeRating,
     confidence95:b.confidence95,calibrationStatus:'reviewed-calibrated',ratedEnabled:false,
     sourceGames:b.measuredFromGames};
 });
 const artifact={
   schema:ASSIGNMENT_VERSION,releaseId,policy:POLICY_ID,ruleset:RULE,
   ratingModel:report.method,reference:report.reference,
   evidenceSha256:sum(evidenceBytes),experimentId:report.experimentId,
   sourceFingerprints:report.sourceFingerprints,
   calibration:{complete:true,pairedGames:report.sampling.pairedGames,
     colorAdvantageElo:report.blackAdvantageElo,colorConfidence95:report.blackAdvantage95},
   review:{approved:true,reviewer:reviewer.trim(),rationale:rationale.trim(),
     reviewedAt:new Date().toISOString(),acknowledgedRelativeAnchor:true},
   bots:estimates,ratedEnabled:false,
   notes:'Never modifies E1 registry, existing PvP or user Elo. Human-release approval is NOT an authorization to settle rated matches.'
 };
 resolveAssignments(artifact);
 return artifact;
}
async function main(){
 const flags=argumentsFor(process.argv.slice(2));
 const source=flags.get('--evidence'),dest=flags.get('--out');
 if(!source||!dest)throw Error('Required: --evidence and --out');
 const artifact=await stageReviewAssignment({
   evidence:resolve(source),openings:Number(flags.get('--openings')||16),
   seed:Number(flags.get('--seed')||20261013),bootstrap:Number(flags.get('--bootstrap')||120),
   releaseId:flags.get('--release'),reviewer:flags.get('--reviewer'),rationale:flags.get('--review-note'),
   approvedReviewed:flags.has('--approve-reviewed'),acceptRelativeAnchor:flags.has('--accept-relative-anchor')
 });
 await mkdir(dirname(resolve(dest)),{recursive:true});
 await writeFile(resolve(dest),JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
 console.log('Review-approved, non-rated calibration assignment written:',resolve(dest));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(e.message);process.exitCode=1;});
}
