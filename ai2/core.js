/* Gomoku 1.3 — AI 2.0 pure calibration/adaptation model.
 * No DOM, storage, network or engine dependency. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuAI2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.3.0';
  const LEVELS=Object.freeze(['first','beg','club','mid','advanced','high','expert','maximum']);
  const LABELS=Object.freeze({first:'Beginner',beg:'Casual',club:'Club',mid:'Tactical',advanced:'Advanced',high:'Challenging',expert:'Expert',maximum:'Master'});
  const TUNING=Object.freeze({
    first:{multiPV:5,time:1,depth:0,width:0},
    beg:{multiPV:5,time:1,depth:0,width:0},
    club:{multiPV:4,time:1,depth:0,width:0},
    mid:{multiPV:4,time:1,depth:0,width:0},
    advanced:{multiPV:3,time:1.05,depth:0,width:1},
    high:{multiPV:3,time:1.10,depth:0,width:1},
    expert:{multiPV:2,time:1.15,depth:1,width:2},
    maximum:{multiPV:1,time:1.25,depth:1,width:2}
  });
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const levelIndex=x=>Math.max(0,LEVELS.indexOf(x));
  const validLevel=x=>LEVELS.includes(x);
  function tuneSearch(level,base={}){
    level=validLevel(level)?level:'mid';const t=TUNING[level];
    const out={...base};
    out.timeMs=Math.round(clamp((Number(base.timeMs)||540)*t.time,20,15000));
    out.maxDepth=Math.round(clamp((Number(base.maxDepth)||5)+t.depth,1,20));
    out.width=Math.round(clamp((Number(base.width)||12)+t.width,2,36));
    out.multiPV=t.multiPV;out.randomPool=1;
    out.ai2={version:VERSION,policy:'strong-level-compute',level};
    return out;
  }
  function normalizeGame(g){
    if(!g||typeof g!=='object'||!validLevel(g.effectiveLevel))return null;
    const outcome=['win','draw','loss'].includes(g.outcome)?g.outcome:null;
    if(!outcome)return null;
    return {id:String(g.id||''),at:Number(g.at)||0,outcome,effectiveLevel:g.effectiveLevel,
      selectedLevel:validLevel(g.selectedLevel)?g.selectedLevel:g.effectiveLevel,
      assisted:g.assisted===true,rule:String(g.rule||'')};
  }
  function eligible(history,current){
    return (Array.isArray(history)?history:[]).map(normalizeGame).filter(Boolean)
      .filter(g=>!g.assisted&&g.effectiveLevel===current).sort((a,b)=>a.at-b.at).slice(-8);
  }
  function performance(rows){
    if(!rows.length)return {games:0,wins:0,draws:0,losses:0,score:.5};
    let wins=0,draws=0,losses=0,total=0,weight=0;
    rows.forEach((g,i)=>{const w=.78+.22*(i+1)/rows.length;weight+=w;if(g.outcome==='win'){wins++;total+=w;}else if(g.outcome==='draw'){draws++;total+=.5*w;}else losses++;});
    return {games:rows.length,wins,draws,losses,score:Number((total/weight).toFixed(3))};
  }
  function freshAdaptive(selected,games=0){
    selected=validLevel(selected)?selected:'mid';
    return {version:1,selected,current:selected,lastChangeGameCount:Math.max(0,Number(games)||0),changes:0};
  }
  function resolveAdaptive(selected,history=[],prior=null){
    selected=validLevel(selected)?selected:'mid';
    const all=(Array.isArray(history)?history:[]).map(normalizeGame).filter(Boolean);
    let state=prior&&prior.version===1&&validLevel(prior.current)&&validLevel(prior.selected)
      ?{version:1,selected:prior.selected,current:prior.current,lastChangeGameCount:Math.max(0,Number(prior.lastChangeGameCount)||0),changes:Math.max(0,Number(prior.changes)||0)}
      :freshAdaptive(selected,0);
    if(state.selected!==selected)state=freshAdaptive(selected,all.length);
    const rows=eligible(all,state.current),perf=performance(rows);
    const sinceChange=Math.max(0,all.length-state.lastChangeGameCount);
    if(rows.length<4)return {level:state.current,state,performance:perf,changed:false,reason:'need-more-games'};
    if(sinceChange<2)return {level:state.current,state,performance:perf,changed:false,reason:'cooldown'};
    let delta=0;
    if(perf.score>=.72)delta=1; else if(perf.score<=.28)delta=-1;
    const next=LEVELS[clamp(levelIndex(state.current)+delta,0,LEVELS.length-1)];
    if(!delta||next===state.current)return {level:state.current,state,performance:perf,changed:false,reason:'well-matched'};
    state={...state,current:next,lastChangeGameCount:all.length,changes:state.changes+1};
    return {level:next,state,performance:perf,changed:true,reason:delta>0?'promoted':'eased'};
  }
  function calibrationAudit(levelConfigs={}){
    const rows=LEVELS.map((level,i)=>{
      const cfg=levelConfigs[level]||{},tuned=tuneSearch(level,cfg);
      return {level,label:LABELS[level],index:i,timeMs:tuned.timeMs,maxDepth:tuned.maxDepth,width:tuned.width,multiPV:tuned.multiPV};
    });
    const monotonicTime=rows.every((r,i)=>!i||r.timeMs>=rows[i-1].timeMs);
    const monotonicDepth=rows.every((r,i)=>!i||r.maxDepth>=rows[i-1].maxDepth);
    const monotonicWidth=rows.every((r,i)=>!i||r.width>=rows[i-1].width);
    const focusedStrongSearch=rows.every((r,i)=>!i||r.multiPV<=rows[i-1].multiPV);
    return {version:VERSION,rows,checks:{monotonicTime,monotonicDepth,monotonicWidth,focusedStrongSearch},
      pass:monotonicTime&&monotonicDepth&&monotonicWidth&&focusedStrongSearch};
  }
  function benchmarkSummary(rows=[]){
    const xs=Array.isArray(rows)?rows.filter(Boolean):[];
    const tactics=xs.filter(x=>x.kind==='tactical'),quiet=xs.filter(x=>x.kind==='quiet');
    const tacticalPass=tactics.length?tactics.every(x=>x.pass===true):false;
    const agreements=quiet.filter(x=>typeof x.agree==='boolean');
    const agreement=agreements.length?agreements.filter(x=>x.agree).length/agreements.length:null;
    return {positions:xs.length,tactical:tactics.length,tacticalPass,quiet:quiet.length,
      referenceAgreement:agreement===null?null:Number(agreement.toFixed(3)),
      scope:'Deterministic fixture benchmark; reference agreement is not Elo, win probability, or proof of optimal play.'};
  }
  return Object.freeze({VERSION,LEVELS,LABELS,TUNING,tuneSearch,normalizeGame,eligible,performance,freshAdaptive,resolveAdaptive,calibrationAudit,benchmarkSummary});
});