/* A5 — study plan for actual reviewed Gomoku positions.
   Pure, deterministic; never edits original mistake cards, schedules or event IDs. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root&&typeof root==='object')root.GomokuPractice5=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const DAY=86400000,POINT=i=>Number.isInteger(i)&&i>=0&&i<225;
 const THEMES=Object.freeze([
   {id:'finish',title:'Finish the win',desc:'Spot immediate wins before extending an attack'},
   {id:'forced-defense',title:'Urgent defense',desc:'Stop an immediate five or a known forcing threat'},
   {id:'double-threat',title:'Double threats',desc:'Understand open fours and simultaneous finishing points'},
   {id:'forbidden',title:'Renju legality',desc:'Check forbidden Black formations and exact-five restrictions'},
   {id:'forcing-sequence',title:'Forcing calculations',desc:'Calculate validated four/three attack continuations'},
   {id:'opening',title:'Opening fundamentals',desc:'Establish legal early-board foundations'},
   {id:'position',title:'Position judgment',desc:'Compare promising lines when no tactic is proven'}
 ]);
 const TITLE=Object.fromEntries(THEMES.map(t=>[t.id,t]));
 const equalBoard=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===225&&a.every((n,i)=>n===b[i]);
 function theme(result,position={},rule='freestyle'){
   const f=result?.facts||{};
   const p=Number.isInteger(position.ply)?position.ply:225;
   const shape=result?.playedShape||{};
   if(f.ownWins?.length&&!f.win||result?.label==='Missed win'||result?.label==='Win available')return 'finish';
   if(f.replies?.length||result?.refutation||result?.opponentThreat||result?.defense?.rootThreat)return 'forced-defense';
   if(rule==='renju-practice'&&(result?.label==='Illegal'||shape?.reason?.includes('forbidden')))return 'forbidden';
   if((f.finishes||[]).length>=2||shape.fours?.length>=2)return 'double-threat';
   if(result?.bestProof||result?.tactical?.verified||shape.threes?.length||shape.fours?.length)return 'forcing-sequence';
   if(p<=6)return 'opening';
   return 'position';
 }
 // Same-root comparison is an evidence gate, not a winning-percentage estimator.
 function sameRoot(r){
   if(!r?.search?.sameRootComparison)return false;
   const played=r.candidates?.find(c=>c.i===r.played),best=r.candidates?.find(c=>c.i===r.best);
   return !!(played&&best&&played.bound==='exact'&&best.bound==='exact'&&
     played.comparison?.scoreComparable===true&&best.comparison?.scoreComparable===true&&
     played.depth>=2&&played.depth===best.depth&&Number.isFinite(played.score)&&Number.isFinite(best.score));
 }
 function qualification(r,p,rule,diagnose){
   if(!r||!p)return {eligible:false,evidence:'unknown',reason:'This position is not analyzed.'};
   const cls=typeof diagnose==='function'?diagnose(r,p):null;
   const facts=r.facts||{},immediate=Array.isArray(facts.ownWins)&&facts.ownWins.length&&!facts.win;
   const threat=Array.isArray(facts.replies)&&facts.replies.length&&!facts.alreadyLost;
   if(facts.alreadyLost)return {eligible:false,evidence:'already-lost',reason:'Already lost before this move. Not an avoidable new mistake.'};
   if(!POINT(r.best)||!POINT(r.played)||r.best===r.played)return {eligible:false,evidence:'unknown',reason:'No separate legal alternative established.'};
   if(immediate||threat)return {eligible:true,evidence:'rules',reason:immediate?'Missed legal immediate win':'Allowed a legal immediate winning reply'};
   if(cls?.bucket==='verified'&&cls.needsReview===true)return {eligible:true,evidence:'verified',reason:cls.note};
   if(sameRoot(r)&&['Blunder','Mistake','Inaccuracy','Losing move','Missed win','Win available'].includes(r.label))
     return {eligible:true,evidence:'provisional',reason:'Comparable selective-search alternative; recheck during practice'};
   return {eligible:false,evidence:'unknown',reason:'Incomplete or non-comparable engine evidence. Review, but do not schedule as mastered.'};
 }
 function gamePlan(positions,results,game,{analysis,diagnose}={}){
   const issues=[],skipped=[];
   if(!Array.isArray(positions)||!Array.isArray(results)||!game||!analysis)return {issues,skipped,byTheme:{},eligible:0};
   for(let k=0;k<positions.length;k++){
     const p=positions[k],r=results[k];
     if(game.mode==='ai'&&p.color!==game.humanColor)continue;
     const q=qualification(r,p,game.variant,diagnose),t=theme(r,p,game.variant);
     if(!q.eligible){if(q.evidence==='unknown')skipped.push({index:k,reason:q.reason});continue;}
     let card=null;try{if(analysis.trainable(r))card=analysis.makeCard(r,p,game);}catch{}
     if(!card){skipped.push({index:k,reason:'Current card schema or engine does not support this position.'});continue;}
     issues.push({index:k,ply:p.ply,theme:t,evidence:q.evidence,reason:q.reason,id:card.id,card});
   }
   const byTheme={};
   for(const issue of issues)(byTheme[issue.theme]||(byTheme[issue.theme]=[])).push(issue);
   return {issues,skipped,byTheme,eligible:issues.length,total:positions.length,
     warning:'Only eligible problems are copied into the original mistake-card library; attempts are still graded after a fresh analysis.'};
 }
 function due(card,now=Date.now()){
   return Number.isFinite(card?.stats?.due)?card.stats.due<=now:true;
 }
 function cardPlan(cards,{now=Date.now(),focus='all',limit=60}={}){
   const items=[];
   for(const c of Array.isArray(cards)?cards:[]){
     if(!c||typeof c.id!=='string'||!Array.isArray(c.board)||c.board.length!==225)continue;
     const topic=theme(c.reference||{},c.source||{},c.rule);
     const evidence=qualification(c.reference||{}, {board:c.board,color:c.color}, c.rule).evidence;
     const dueAt=Number.isFinite(c.stats?.due)?c.stats.due:now;
     const streak=Math.max(0,Number(c.stats?.streak)||0);
     const recent=Number.isFinite(c.stats?.last)?c.stats.last:0;
     const isDue=dueAt<=now;
     const lapses=Math.max(0,Number(c.stats?.lapses)||0);
     if(focus!=='all'&&focus!=='due'&&topic!==focus)continue;
     if(focus==='due'&&!isDue)continue;
     const priority=(isDue?100:0)+Math.min(35,lapses*7)+(evidence==='rules'?14:evidence==='verified'?10:0)-Math.min(18,streak*3);
     items.push({id:c.id,theme:topic,title:TITLE[topic]?.title||'Position judgment',evidence,
       due:isDue,dueAt,priority,streak,lapses,attempts:c.stats?.attempts||0,
       assisted:c.stats?.assisted||0,from:recent});
   }
   items.sort((a,b)=>b.priority-a.priority||a.dueAt-b.dueAt||a.id.localeCompare(b.id));
   const byTheme={};
   for(const c of items)byTheme[c.theme]=(byTheme[c.theme]||0)+1;
   return {items:items.slice(0,Math.max(1,Math.min(500,limit))),due:items.filter(c=>c.due).length,
     themes:byTheme,shown:Math.min(items.length,Math.max(1,limit)),total:items.length,
     disclaimer:'Due dates come from existing saved stats. This planner never writes or replaces recall events.'};
 }
 function answerPolicy(r,reference,{assisted=false,verifiedTarget=false}={}){
   const unscored={status:'unresolved',advance:false,assisted,
     message:'Not enough evidence to score this response. Your review interval and recall history are unchanged.'};
   if(!r||!reference||r.basis==='insufficient-search'||r.label==='Unscored')return unscored;
   const needWin=verifiedTarget||reference?.facts?.ownWins?.length>0;
   const immediateWin=r.facts?.win===true;
   const certifiedWin=!!(r.bestProof?.format==='GomokuStudioProof'&&r.bestProof?.proof&&
     r.bestProof.proof.move===r.played&&r.basis==='verified-proof');
   if(needWin){
     if(immediateWin||certifiedWin)return {status:'correct',advance:!assisted,assisted,
       message:assisted?'Winning answer after help; recorded only as assisted.':'Winning line established for this attempt.'};
     // A 'Good' label from selective search is never enough to solve a proven-win puzzle.
     return r.refutation?{status:'incorrect',advance:false,assisted,message:'The move allows a proved losing reply; study its verified proof.'}:unscored;
   }
   if(r.refutation||r.facts?.replies?.length)
     return {status:'incorrect',advance:false,assisted,message:'An immediate or independently checked opponent win remains.'};
   if(sameRoot(r)&&r.played===r.best&&['Best found','Good','Defensive move'].includes(r.label))
     return {status:'correct',advance:!assisted,assisted,message:assisted?'Search-supported move after help. Not counted as unassisted recall.':'The move is supported by a same-root completed search; still an engine estimate.'};
   if(sameRoot(r)&&['Blunder','Mistake','Inaccuracy','Losing move'].includes(r.label))
     return {status:'incorrect',advance:false,assisted,message:'Completed search favors a different legal alternative. Review both lines.'};
   return unscored;
 }
 return Object.freeze({VERSION:'3.0.0-a5',THEMES,theme,sameRoot,qualification,gamePlan,due,cardPlan,answerPolicy,DAY});
});
