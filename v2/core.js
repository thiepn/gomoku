/* Gomoku 2.0 — Unified Player Journey pure composition model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuV2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='2.0.0';
  const text=v=>String(v??'').trim();
  const n=(v,min=0,max=100000)=>Math.max(min,Math.min(max,Math.trunc(Number(v)||0));
  function safePrimary(journey={}){
    const p=journey?.next;
    if(p&&text(p.id)&&text(p.label))return {id:text(p.id),label:text(p.label),detail:text(p.detail),priority:n(p.priority,0,1000)};
    return {id:'new-game',label:'Play a game',detail:'Start a game and create material for the improvement loop.',priority:0};
  }
  function learning(raw={}){
    const summary=raw?.summary||{},skills=Array.isArray(raw?.skills)?raw.skills:[],p=Array.isArray(raw?.prescriptions)?raw.prescriptions[0]:null;
    return {
      total:skills.length,
      mastered:n(summary.mastered),strong:n(summary.strong),developing:n(summary.developing),
      due:n(summary.dueReviews),
      focus:text(raw?.focus?.title||raw?.focus?.skill?.title||p?.title||'Build learning evidence'),
      next:p?{type:text(p.type),title:text(p.title)||'Next learning task',reason:text(p.reason)}:null
    };
  }
  function course(raw={}){
    const chapters=Array.isArray(raw?.chapters)?raw.chapters:[],next=raw?.next||null;
    return {
      total:chapters.length||14,mastered:n(raw?.mastered),completed:n(raw?.completed),
      next:next?{id:n(next.id,1,99),title:text(next.title)||'Next chapter',state:text(next.state)||'learn',reason:text(next.reason),completion:n(next.completion,0,100),skillScore:n(next.skillScore,0,100)}:null
    };
  }
  function archive(raw={}){
    const c=raw?.counts||{},p=raw?.primary||null;
    return {
      total:n(c.total),studies:n(c.studies),needsReview:n(c.needsReview),flagged:n(c.flagged),
      primary:p?{id:text(p.id),label:text(p.label),detail:text(p.detail),entryId:text(p.entryId)}:null
    };
  }
  function opening(raw={}){
    const skills=raw?.skills||{},p=raw?.primary||null;
    return {
      position:text(raw?.position)||'Opening study ready',
      average:n(skills.average,0,100),evidenced:n(skills.evidenced),due:n(skills.due),
      primary:p?{id:text(p.id),label:text(p.label),detail:text(p.detail)}:null
    };
  }
  function competition(raw={}){
    const phase=raw?.phase||{},next=raw?.next||{},progress=raw?.progress||null;
    return {
      active:phase.active===true,
      state:text(phase.state)||'inactive',
      action:text(next.action),
      label:text(next.label),
      detail:text(next.detail),
      progress:progress?{label:text(progress.label),score:text(progress.score),value:n(progress.value),max:Math.max(1,n(progress.max,1))}:null
    };
  }
  function online(raw={}){
    return {
      identity:text(raw?.identity)||'Local player',
      room:text(raw?.room)||'No active online room',
      primary:raw?.primary?{id:text(raw.primary.id),label:text(raw.primary.label),detail:text(raw.primary.detail)}:null
    };
  }
  function model(raw={}){
    const j=raw.journey||{},ctx=j.context||{},primary=safePrimary(j),learn=learning(raw.learning),curriculum=course(raw.course),
      lib=archive(raw.library),open=opening(raw.opening),comp=competition(raw.competitive),net=online(raw.online);
    const game=ctx.game||{};
    const plan=Array.isArray(j?.plan?.tasks)?j.plan.tasks.slice(0,5).map(x=>({
      id:text(x.id),label:text(x.label)||'Study task',detail:text(x.detail),minutes:n(x.minutes,0,180)
    })):[];
    const status={
      game:n(game.moves)>0?(game.result?'Finished game':n(game.moves)+' moves · '+(text(game.mode)||'game')):'Fresh board',
      learning:learn.total?learn.mastered+' mastered · '+learn.strong+' strong · '+learn.due+' due':'Learning evidence begins with lessons, practice and reviewed games',
      course:curriculum.next?'Chapter '+curriculum.next.id+' · '+curriculum.next.title:'Course ready',
      archive:lib.total?lib.total+' saved · '+lib.needsReview+' need review':'Library ready',
      opening:open.evidenced?open.average+'% opening skill evidence':'Opening evidence not established yet'
    };
    return {
      version:VERSION,primary,plan,learning:learn,course:curriculum,library:lib,opening:open,competitive:comp,online:net,status,
      game:{moves:n(game.moves),result:!!game.result,inProgress:!!game.inProgress,mode:text(game.mode),title:text(game.title)||'Current game'}
    };
  }
  return Object.freeze({VERSION,model});
});
