/* Gomoku 1.6 — Competitive Play 2.0 pure orchestration model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuCompetitive2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.6.0';
  const n=(v,min=0,max=999)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0)));
  function normalize(status={},game={}){
    if(!status||typeof status!=='object'||!status.config)return null;
    const total=Math.max(1,n(status.config.total||1,1,9));
    const a=n(status.score?.a,0,total),b=n(status.score?.b,0,total),games=n(status.score?.games,a+b,total);
    const terminal=!!(game.terminal||game.result);
    const done=!!status.done;
    const current=Math.max(1,Math.min(total,n(status.game||games+1,1,total)));
    const clock={
      enabled:!!status.clock?.enabled,
      running:!!status.clock?.running,
      side:n(status.clock?.side,0,2),
      remaining:Array.isArray(status.clock?.remaining)?status.clock.remaining.slice(0,3):[]
    };
    return {
      version:VERSION,total,a,b,games,current,terminal,done,clock,
      names:{
        p1:String(status.names?.p1||'Player 1').slice(0,60),
        p2:String(status.names?.p2||'Player 2').slice(0,60)
      },
      opening:String(status.config.opening||'free'),
      minutes:n(status.config.minutes,0,180),
      increment:n(status.config.increment,0,180)
    };
  }
  function phase(status={},game={}){
    const s=normalize(status,game);if(!s)return {state:'inactive',active:false};
    if(s.terminal&&s.done)return {...s,state:'match-complete',active:true};
    if(s.terminal)return {...s,state:'between-games',active:true};
    if(s.clock.enabled&&!s.clock.running)return {...s,state:'clock-paused',active:true};
    return {...s,state:'in-game',active:true};
  }
  function next(status={},game={}){
    const s=phase(status,game);
    if(!s.active)return {action:'none',label:'',eyebrow:'',detail:''};
    if(s.state==='between-games')return {
      action:'next-game',
      label:s.opening==='free'?'Next game · swap colors':'Next game · opening procedure',
      eyebrow:'MATCH CONTINUES',
      detail:`Game ${s.games} complete · ${s.names.p1} ${s.a}–${s.b} ${s.names.p2}. Continue with game ${Math.min(s.total,s.games+1)} of ${s.total}.`
    };
    if(s.state==='match-complete')return {
      action:'new-match',
      label:'New competitive match',
      eyebrow:'MATCH COMPLETE',
      detail:`${s.names.p1} ${s.a}–${s.b} ${s.names.p2} · ${s.games} game${s.games===1?'':'s'} played.`
    };
    if(s.state==='clock-paused')return {
      action:'resume-clock',
      label:'Resume clock',
      eyebrow:'COMPETITIVE MATCH',
      detail:`Game ${s.current} of ${s.total} · ${s.names.p1} ${s.a}–${s.b} ${s.names.p2}.`
    };
    return {
      action:'play',
      label:'Continue game',
      eyebrow:'COMPETITIVE MATCH',
      detail:`Game ${s.current} of ${s.total} · ${s.names.p1} ${s.a}–${s.b} ${s.names.p2}.`
    };
  }
  function progress(status={},game={}){
    const s=phase(status,game);if(!s.active)return null;
    const decided=Math.min(s.total,s.games);
    return {
      state:s.state,value:decided,max:s.total,
      label:s.done?`Match complete · ${s.a}–${s.b}`:`Game ${s.current} of ${s.total} · match ${s.a}–${s.b}`,
      score:`${s.names.p1} ${s.a}–${s.b} ${s.names.p2}`
    };
  }
  return Object.freeze({VERSION,normalize,phase,next,progress});
});