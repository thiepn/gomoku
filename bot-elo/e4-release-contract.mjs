/**
 * E4 offline release-admission contract, NOT a deployment/migration tool.
 *
 * Converts a separately reviewed E3 calibration artifact into an auditable,
 * source-pinned PostgreSQL *proposal*. Does not read credentials, connect to
 * Supabase, update records, activate ratings or award Elo. A different,
 * explicitly authorized review/release process must consume the proposal.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveAssignments} from './calibration/assignments.mjs';
import {POLICY_ID,RULE} from './calibration/e2-policy.mjs';

const POLICY='gomoku-bot-e4-release-proposal/1.0.0';
const digest=s=>createHash('sha256').update(s).digest('hex');
function requireValid(value,message){if(!value)throw Error('Bot Elo E4 release proposal refused: '+message);}
export function prepareReleaseProposal(manifest,rawFile){
 const resolved=resolveAssignments(manifest);
 requireValid(resolved.source===manifest.releaseId,'unreviewed E3 manifest');
 requireValid(manifest.schema==='gomoku-bot-calibration-assignment/1.0.0','unsupported E3 assignment');
 requireValid(manifest.policy===POLICY_ID&&manifest.ruleset===RULE,'policy mismatch');
 requireValid(manifest.calibration?.complete===true,'incomplete evidence');
 requireValid(manifest.review?.approved===true&&
   manifest.review.acknowledgedRelativeAnchor===true,'unacknowledged non-human rating anchor');
 requireValid(manifest.review?.rationale?.length>=80,'missing substantive reviewer rationale');
 requireValid(manifest.ratedEnabled===false,'E3 assignment must not have live Elo enabled');
 requireValid(manifest.bots.every(b=>b.ratedEnabled===false),'bot permission cannot be silently enabled');
 requireValid(/^[0-9a-f]{64}$/.test(manifest.experimentId),'missing experiment identity');
 requireValid(/^[0-9a-f]{64}$/.test(manifest.evidenceSha256),'missing original evidence hash');
 requireValid(typeof rawFile==='string'&&rawFile.length>0,'exact reviewed JSON bytes required');
 const canonicalHashes=Object.fromEntries(Object.entries(manifest.sourceFingerprints||{}));
 requireValid(Object.keys(canonicalHashes).length>=4 &&
   Object.values(canonicalHashes).every(v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v)),
   'invalid policy and source fingerprints');
 const botRatings=Object.fromEntries(resolved.bots.map(b=>{
   requireValid(b.calibrationStatus==='reviewed-calibrated'&&b.ratingUncertainty!==null,
     'not all bots are evidence-calibrated');
   const milli=Math.round(b.targetElo*1000);
   requireValid(Number.isSafeInteger(milli)&&milli>=400000&&milli<=6000000,'invalid bot rating');
   return [b.id,milli];
 }));
 return Object.freeze({
   schema:POLICY,status:'review-ready-not-activated',
   release:Object.freeze({
     release_id:manifest.releaseId,
     schema_version:manifest.schema,
     policy_id:POLICY_ID,
     ruleset:RULE,
     source_experiment_id:manifest.experimentId,
     source_sha256:manifest.evidenceSha256,
     approved_manifest_sha256:digest(rawFile),
     reviewer:manifest.review.reviewer,
     review_rationale:manifest.review.rationale,
     review_approved_at:manifest.review.reviewedAt,
     calibration_complete:true,
     bot_ratings_milli:Object.freeze(botRatings)
   }),
   activation:Object.freeze({enabled:false,active_release_id:null}),
   sourceFingerprints:Object.freeze(canonicalHashes),
   warnings:Object.freeze([
     'Proposal is not inserted into a database and is not an active rating release.',
     'The original E3 rating scale has an arbitrary anchor, not human-rated Elo.',
     'Only explicit subsequent authorized release control can activate live Bot Elo.'
   ])
 });
}
async function main(args){
 let input=null,output=null;
 for(let i=0;i<args.length;i++){
   if(args[i]==='--in')input=args[++i];
   else if(args[i]==='--out')output=args[++i];
   else throw Error('Unexpected option '+args[i]);
 }
 if(!input||!output)throw Error('Usage: node bot-elo/e4-release-contract.mjs --in reviewed.json --out proposal.json');
 const raw=await readFile(resolve(input),'utf8');
 const proposal=prepareReleaseProposal(JSON.parse(raw),raw);
 await mkdir(dirname(resolve(output)),{recursive:true});
 await writeFile(resolve(output),JSON.stringify(proposal,null,2)+'\n',{flag:'wx'});
 console.log('Prepared DISABLED Bot Elo release proposal:',resolve(output));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
