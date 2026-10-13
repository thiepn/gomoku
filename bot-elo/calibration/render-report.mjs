/**
 * Present an observed E3 JSON report in readable Markdown, with uncertainty
 * and every evidence caveat preserved. Nothing is estimated in this renderer.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const clean=s=>String(s??'').replace(/[|\r\n]/g,' ').replace(/</g,'&lt;');
const val=n=>Number.isFinite(n)?Number(n).toFixed(1):'—';
export function toMarkdown(report){
 if(!report||report.schema!=='gomoku-calibration-report/1.0.0'||
    !Array.isArray(report.bots)||report.bots.length!==8)
   throw Error('Not a complete-format Gomoku calibration report.');
 const sm=report.sampling||{},lines=[
  '# Gomoku E3 — Empirical Bot Calibration Report',
  '',
  '**Status:** '+(report.candidateReviewable?'Complete candidate awaiting independent approval':
    'Preliminary / insufficient evidence — not calibrated'),
  '',
  '**Experiment:** '+clean(report.experimentId),
  '',
  '**Native policy:** '+clean(report.policy)+' · **Rules:** '+clean(report.rule),
  '',
  '## Evidence coverage',
  '',
  '| Planned games | Recorded games | Balanced games | Matched pairs | Full schedule |',
  '|---:|---:|---:|---:|---|',
  '| '+(sm.scheduledGames??0)+' | '+(sm.recordedGames??0)+' | '+(sm.pairedGames??0)+
    ' | '+(sm.completedMatchedPairs??0)+' | '+(sm.complete?'Yes':'No')+' |',
  '',
  '**Black advantage:** '+val(report.blackAdvantageElo)+' relative Elo'+
    (report.blackAdvantage95?' (95% model-dependent interval '+val(report.blackAdvantage95.low)+
      '–'+val(report.blackAdvantage95.high)+')':' (not estimated)'),
  '',
  '**Anchor:** '+clean(report.reference?.bot)+' = '+clean(report.reference?.rating)+
    ' (arbitrary internal scale, not human Elo).',
  '',
  '## Candidate bot strengths',
  '',
  '| Bot | Games | W–D–L | Black / White | Estimated relative Elo | 95% interval | Status |',
  '|---|---:|---|---|---:|---|---|'
 ];
 for(const b of report.bots){
   const r=b.record||{},range=b.confidence95?val(b.confidence95.low)+'–'+val(b.confidence95.high):'Unavailable';
   lines.push('| '+clean(b.displayName)+' ('+clean(b.id)+') | '+(b.measuredFromGames||0)+
     ' | '+[r.wins||0,r.draws||0,r.losses||0].join('–')+' | '+(r.black||0)+' / '+(r.white||0)+
     ' | '+val(b.candidateRelativeRating)+' | '+range+' | '+clean(b.status)+' |');
 }
 lines.push('','## Color and opening sensitivity','','| Bot | Black score | White score | No prefix | Center prefix | 3 stones | 5 stones |',
 '|---|---:|---:|---:|---:|---:|---:|');
 for(const b of report.bots){
   const c=b.byColor||{},o=b.byOpeningFamily||{};
   const cell=x=>x?.games?val(x.scoreRate*100)+'% ('+x.games+')':'—';
   const score=n=>n===null||n===undefined?'—':val(n*100)+'%';
   lines.push('| '+clean(b.displayName)+' | '+score(c.blackScoreRate)+' | '+score(c.whiteScoreRate)+
     ' | '+cell(o.empty)+' | '+cell(o.center)+' | '+cell(o.short)+' | '+cell(o.extended)+' |');
 }
 lines.push('','## Limitations','','No actual Elo assignment or live rating reward follows from this report.');
 for(const caveat of report.limitations||[])lines.push('- '+clean(caveat));
 lines.push('','**Rated play enabled:** No. **Approval:** Separate, explicit independent review required.','');
 return lines.join('\n');
}
async function main(args){
 const input=args[0],output=args[1];if(!input||!output)
   throw Error('Usage: node bot-elo/calibration/render-report.mjs report.json report.md');
 const data=JSON.parse(await readFile(resolve(input),'utf8')),text=toMarkdown(data);
 await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(resolve(output),text);
 console.log('Formatted calibration report written:',resolve(output));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
