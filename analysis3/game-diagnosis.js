/* A4 game diagnosis: evidence-aware, pure, variant-independent presentation model.
 * Trust only separately established rules/proofs; never infer guaranteed outcomes from engine scores. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.GomokuGameDiagnosis4=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const POINT=i=>Number.isInteger(i)&&i>=0&&i<225;
 const COORD=i=>POINT(i)?'ABCDEFGHJKLMNOP'[i%15]+(15-Math.floor(i/15)):'Pass';
 const NEGATIVE=new Set(['Blunder','Mistake','Inaccuracy','Missed win','Losing move']);
 const SECONDARY=new Set(['Good','Best found','Winning move','Winning threat','Winning plan','Defensive move']);
 const SIDE=c=>c===1?'Black':'White';
 function playedCandidate(result){
   return result?.candidates?.find(c=>c.i===result.played)||null;
 }
 function bestCandidate(result){
   return result?.candidates?.find(c=>c.i===result.best)||null;
 }
 function sameRoot(result){
   const played=playedCandidate(result),best=bestCandidate(result);
   return !!(result?.search?.sameRootComparison&&played?.comparison?.scoreComparable&&best?.comparison?.scoreComparable&&
     played.bound==='exact'&&best.bound==='exact'&&Number.isFinite(played.score)&&Number.isFinite(best.score)&&
     Number.isInteger(played.depth)&&played.depth===best.depth&&played.depth>=2);
 }
 function classification(result,position){
   if(!result)return {kind:'pending',bucket:'unresolved',importance:0,certainty:'not analyzed',label:'Not analyzed',
     note:'This move has not been analyzed.',needsReview:false,verified:false};
   const f=result.facts||{},hasAlternative=POINT(result.best)&&result.best!==result.played;
   const immediateMiss=Array.isArray(f.ownWins)&&f.ownWins.length>0&&!f.win;
   const instantLoss=!f.win&&Array.isArray(f.replies)&&f.replies.length>0&&!f.alreadyLost;
   const postProof=result.refutation?.format==='GomokuStudioProof'&&result.refutation?.proof&&
     result.refutation?.position?.[result.played]===position?.color&&result.basis==='verified-proof';
   const priorLost=f.alreadyLost===true||result.defense?.allRefuted===true;
   if(f.win)return {kind:'won-immediately',bucket:'verified',importance:3,certainty:'rule fact',verified:true,
     label:'Immediate win',note:'This move legally completed five; the game ends.',needsReview:false};
   if(priorLost)return {kind:'already-lost',bucket:'verified',importance:1,certainty:'rule fact or exhaustive verified defense',verified:true,
     label:'Already lost',note:'The position was already lost before this move. Do not count it as a new avoidable mistake.',needsReview:false};
   if(immediateMiss)return {kind:'missed-immediate-win',bucket:'verified',importance:5,certainty:'rule fact',verified:true,
     label:'Missed immediate win',note:'A legal one-move win existed before this decision. This move did not finish the game; it is not automatically a proven loss.',needsReview:true};
   if(instantLoss)return {kind:'allows-immediate-win',bucket:'verified',importance:5,certainty:'rule fact',verified:true,
     label:'Immediate winning reply',note:'The opponent has a legal one-move finish after this move. Whether every alternative also loses needs separate evidence.',needsReview:true};
   if(postProof)return {kind:'verified-opponent-win-after',bucket:'verified',importance:5,certainty:'verified forcing proof',verified:true,
     label:'Verified losing continuation',note:'A checked forcing win exists for the opponent after this move; avoidability has not been established.',needsReview:true};
   if(result.bestProof?.format==='GomokuStudioProof'&&hasAlternative)
     return {kind:'verified-winning-alternative',bucket:'verified',importance:4,certainty:'verified forcing proof',verified:true,
       label:'Verified winning alternative',note:'A verified forcing win was available from this position. The recorded move has not thereby been proven to lose.',needsReview:true};
   if(result.basis==='verified-defense'||result.defense?.rootThreat&&result.defense?.defenses?.includes(result.played))
     return {kind:'known-threat-blocked',bucket:'verified',importance:2,certainty:'verified threat interrupted',verified:true,
       label:'Known threat blocked',note:'The recorded move interrupts a previously verified attack. Other threats may remain.',needsReview:false};
   if(NEGATIVE.has(result.label)&&sameRoot(result)&&hasAlternative)
     return {kind:'provisional-mistake',bucket:'provisional',importance:result.label==='Blunder'?4:result.label==='Mistake'?3:2,
       certainty:'same-root search estimate',verified:false,label:result.label,
       note:'The searched alternative evaluates better at a comparable completed depth. This is not proof of a forced outcome.',needsReview:true};
   if(NEGATIVE.has(result.label))
     return {kind:'unconfirmed-mistake',bucket:'unresolved',importance:2,certainty:'incomplete comparison',verified:false,
       label:'Unconfirmed move judgment',note:'The current evidence cannot justify a numerical or causal mistake grade.',needsReview:true};
   if(result.label==='Unscored'||result.basis==='insufficient-search')
     return {kind:'unscored',bucket:'unresolved',importance:1,certainty:'insufficient search',verified:false,
       label:'Unscored',note:'The available search does not establish a comparable decision.',needsReview:false};
   if(SECONDARY.has(result.label))return {kind:'no-error-shown',bucket:'provisional',importance:0,certainty:'search estimate or positional fact',verified:false,
     label:result.label,note:'No error established here by the current search; this is not a proof of perfect play.',needsReview:false};
   return {kind:'unknown',bucket:'unresolved',importance:0,certainty:'not established',verified:false,
     label:'Unresolved',note:'No justified conclusion from the available evidence.',needsReview:false};
 }
 function contrast(result,position,core,rule){
   if(!result||!position)return null;
   const hasPlayed=POINT(result.played),hasBest=POINT(result.best),different=hasPlayed&&hasBest&&result.played!==result.best;
   const played=playedCandidate(result),best=bestCandidate(result);
   const safeLine=(i,source)=>{
     if(!POINT(i)||!source||!Array.isArray(position.board))return [];
     const proposed=Array.isArray(source.pv)?source.pv:[];
     const pref=proposed[0]===i?proposed:[i,...proposed];
     try {
       const legal=core.line(position.board,position.color,rule,pref.slice(0,16),position.context).moves||[];
       return legal[0]===i?legal.slice(0,8):[];
     }catch{return [];}
   };
   const playedLine=safeLine(result.played,played),bestLine=different?safeLine(result.best,best):[];
   const cmp=sameRoot(result)&&different&&playedLine.length>0&&bestLine.length>0;
   const gap=cmp?Math.max(0,best.score-played.score):null;
   const fact=classification(result,position);
   const verdict=fact.kind==='verified-opponent-win-after'?
     'The played position has a verified opponent win. The best found alternative has not been proven safe.':
     fact.kind==='missed-immediate-win'?'The recorded move passed up a legal immediate finish; subsequent loss is not proven.':
     fact.kind==='allows-immediate-win'?'An immediate opponent finish is available after the recorded move.':
     fact.kind==='already-lost'?'This position was already lost before the move; do not assign avoidable blame.':
     cmp?'The alternative is preferred by comparable selective engine estimates, not a forced-game proof.':
     'These continuations do not support a numerical comparison at the current search depth.';
   return {played:result.played,best:hasBest?result.best:null,
     playedLine,bestLine,comparable:cmp,scoreGap:gap,depth:cmp?played.depth:null,
     certainty:fact.certainty,bucket:fact.bucket,verdict,hasAlternative:different&&bestLine.length>0};
 }
 function summarize(positions,results,{mode='all',humanColor=1}={}){
   if(!Array.isArray(positions)||!Array.isArray(results))return {total:0,analyzed:0,coverage:0,events:[],summary:{verified:0,provisional:0,unresolved:0,pending:0},reviewIndices:[],bySide:{}};
   const events=positions.map((p,k)=>{
     const result=results[k]||null,cls=classification(result,p||{});
     return {index:k,ply:p?.ply||k+1,color:p?.color||1,played:p?.played,
       coord:COORD(p?.played),label:cls.label,kind:cls.kind,bucket:cls.bucket,
       importance:cls.importance,certainty:cls.certainty,verified:cls.verified,
       needsReview:cls.needsReview,note:cls.note,hasAnalysis:!!result,
       hasBest:POINT(result?.best)&&result.best!==result.played,
       bestCoord:POINT(result?.best)?COORD(result.best):null,
       searchDepth:result?.search?.completedDepth??null};
   });
   const analyzed=events.filter(e=>e.hasAnalysis).length;
   const summary={verified:0,provisional:0,unresolved:0,pending:0};
   for(const e of events){if(e.bucket==='verified')summary.verified++;else if(e.bucket==='provisional')summary.provisional++;else if(!e.hasAnalysis)summary.pending++;else summary.unresolved++;}
   const focus=mode==='mine'?events.filter(e=>e.color===humanColor):events;
   const impact=focus.filter(e=>e.needsReview)
     .sort((a,b)=>b.importance-a.importance|| (a.bucket==='verified'?-1:1) -(b.bucket==='verified'?-1:1)||a.index-b.index);
   const sideRows=side=>{const r=events.filter(e=>e.color===side);return {moves:r.length,analyzed:r.filter(e=>e.hasAnalysis).length,
     verifiedEvents:r.filter(e=>e.bucket==='verified'&&e.needsReview).length,
     provisionalErrors:r.filter(e=>e.kind==='provisional-mistake').length,unresolved:r.filter(e=>!e.hasAnalysis||e.bucket==='unresolved').length};};
   return {total:events.length,analyzed,coverage:events.length?analyzed/events.length:0,
     events,summary,reviewIndices:impact.map(e=>e.index),
     bySide:{Black:sideRows(1),White:sideRows(2)},
     nextReview:impact[0]?.index??null,
     scope:'Events reflect rule facts, independently validated tactical evidence, provisional same-root search estimates, and unknown positions. No win rate, Elo change, or causal game swing is inferred.'};
 }
 function filterEvents(diagnosis,{side='both',category='all',humanColor=1,limit=100}={}){
   let rows=diagnosis?.events||[];
   if(side==='mine')rows=rows.filter(x=>x.color===humanColor);
   else if(side==='black'||side==='white')rows=rows.filter(x=>x.color===(side==='black'?1:2));
   if(category==='verified')rows=rows.filter(x=>x.bucket==='verified');
   else if(category==='provisional')rows=rows.filter(x=>x.bucket==='provisional'&&x.needsReview);
   else if(category==='unresolved')rows=rows.filter(x=>x.bucket==='unresolved'||x.bucket==='pending');
   else if(category==='key')rows=rows.filter(x=>x.needsReview);
   return rows.slice(0,Math.max(1,Math.min(500,Number.isInteger(limit)?limit:100)));
 }
 return Object.freeze({classification,contrast,summarize,filterEvents,COORD,SIDE,sameRoot});
});
