/* Gomoku 2.0 — Player Journey & Home 2.0 pure orchestration model. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GomokuPlayer2Core=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='2.0.0';
  const n=(v,a=0,b=9999)=>Math.max(a,Math.min(b,Math.round(Number(v)||0)));
  const clean=v=>String(v??'').trim();
  function learning(snapshot={}){
    const skills=Array.isArray(snapshot?.skills)?snapshot.skills:[],summary=snapshot?.summary||{};
    const fallback=skills.filter(s=>Number(s?.evidence)>0||Number(s?.course)>0||Number(s?.score)>0);
    const evidenced=Number.isFinite(Number(summary.evidenced))?n(summary.evidenced):fallback.length;
    const average=Number.isFinite(Number(summary.average))?n(summary.average,0,100):(fallback.length?Math.round(fallback.reduce((sum,s)=>sum+n(s.score,0,100),0)/fallback.length):0);
    const due=Number.isFinite(Number(summary.dueReviews))?n(summary.dueReviews):skills.reduce((sum,s)=>sum+n(s?.due),0);
    const total=Number.isFinite(Number(summary.total))?n(summary.total):skills.length;
    const prescription=(Array.isArray(snapshot?.prescriptions)?snapshot.prescriptions:[])[0]||null;
    return {skills:total,evidenced,average,due,prescription};
  }
  function context(input={}){
    const j=input.journey?.context||{};
    const lib=input.library||{};
    const lc=lib.counts||{};
    const open=input.opening||{};
    const online=input.online||{};
    const comp=input.competitive||{};
    const learn=learning(input.learning||{});
    return {
      journey:j,
      journeyNext:input.journey?.next||null,
      learning:learn,
      library:{
        total:n(lc.total??j.library?.count),
        needsReview:n(lc.needsReview),
        flagged:n(lc.flagged),
        studies:n(lc.studies)
      },
      opening:{
        due:n(open.skills?.due??j.opening?.due),
        average:n(open.skills?.average,0,100),
        evidenced:open.skills?.evidenced===true
      },
      online:{
        active:online.context?.activeRoom===true||j.online?.connected===true,
        primary:online.primary||null,
        label:clean(online.room)||'No active room'
      },
      competitive:{
        active:comp.phase?.active===true&&comp.phase?.state!=='match-complete',
        state:clean(comp.phase?.state),
        next:comp.next||null,
        progress:comp.progress||null
      },
      postgame:input.postgame||null
    };
  }
  const JOURNEY_LABEL={
    'resume-practice':'Resume practice','online':'Return to online play','resume-review':'Resume review',
    'continue-game':'Continue game','analyze-game':'Review finished game','review-critical':'Retry key decisions',
    'train-due':'Practice due material','train-opening':'Review opening lines','train-new':'Learn a new concept',
    'new-game':'Play a game','play':'Play','analyze':'Analyze position','train':'Practice','study':'Study','library':'Open Library'
  };
  function journeyAction(next){
    const id=clean(next?.id);if(!id)return null;
    return {id:'journey:'+id,label:clean(next?.label)||JOURNEY_LABEL[id]||'Continue',detail:clean(next?.detail)||'Continue the current improvement flow.',source:'journey'};
  }
  function primary(input={}){
    const c=context(input);
    if(c.online.active){
      return {id:'online',label:c.online.primary?.label||'Return to online match',detail:c.online.primary?.detail||'An online room is active.',source:'online'};
    }
    if(c.competitive.active){
      return {id:'competitive',label:c.competitive.next?.label||'Continue competitive match',detail:c.competitive.next?.detail||'Your local competitive series is still active.',source:'competition'};
    }
    const j=journeyAction(c.journeyNext);
    if(j&&clean(c.journeyNext?.id)!=='new-game')return j;
    if(c.library.needsReview>0){
      return {id:'review-center',label:'Review saved games',detail:c.library.needsReview+' saved game'+(c.library.needsReview===1?' needs':'s need')+' current or complete review evidence.',source:'library'};
    }
    if(c.learning.prescription){
      const p=c.learning.prescription;
      return {id:'learning-next',label:clean(p.title)||clean(p.label)||'Continue learning',detail:clean(p.reason)||clean(p.detail)||'Follow your current Learning Intelligence prescription.',source:'learning'};
    }
    const practiceDue=Math.max(n(c.journey.training?.due)+n(c.journey.training?.customDue),n(c.learning.due));
    if(practiceDue>0){
      return {id:'training',label:'Practice due material',detail:practiceDue+' due learning or training item'+(practiceDue===1?'':'s')+' are ready.',source:'training'};
    }
    if(c.opening.due>0){
      return {id:'opening',label:'Review opening work',detail:c.opening.due+' opening repetition'+(c.opening.due===1?' is':'s are')+' due.',source:'opening'};
    }
    return j||{id:'play',label:'Play a game',detail:'Create fresh game evidence, then review it and feed the result back into learning.',source:'play'};
  }
  function stages(input={}){
    const c=context(input),j=c.journey,learn=c.learning;
    const reviewWaiting=n(j.review?.pending)+n(j.review?.critical)+c.library.needsReview;
    const practiceDue=n(j.training?.due)+n(j.training?.customDue)+n(learn.due);
    return [
      {id:'play',label:'Play',value:j.game?.inProgress?'In progress':j.game?.result?'Finished game':'Ready',detail:j.game?.inProgress?'Finish the current game before changing the evidence.':'Play a complete game to create useful evidence.'},
      {id:'review-center',label:'Review',value:reviewWaiting?reviewWaiting+' waiting':'Current',detail:reviewWaiting?'Resolve queued, critical or stale game evidence.':'No known review work is currently waiting.'},
      {id:'learning-next',label:'Learn',value:learn.evidenced?learn.average+'% evidence':'Baseline',detail:learn.evidenced?learn.evidenced+' of '+learn.skills+' skills currently have learning evidence.':'Build your first skill evidence through authored lessons and practice.'},
      {id:'training',label:'Practice',value:practiceDue?practiceDue+' due':'Ready',detail:practiceDue?'Retrieve due material before adding more new material.':'Use targeted practice to reinforce a current weakness.'}
    ];
  }
  function threads(input={}){
    const c=context(input);
    return [
      {id:'opening',label:'Openings',value:c.opening.evidenced?c.opening.average+'% evidence':'Baseline',detail:c.opening.due?c.opening.due+' repetition'+(c.opening.due===1?'':'s')+' due':'Opening Study combines concepts, local exploration and repertoire.'},
      {id:'competitive',label:'Competition',value:c.competitive.active?'Active series':'Available',detail:c.competitive.active?(c.competitive.progress?.label||'Continue the active local match series.'):'Start a structured local match when you want game-to-game continuity.'},
      {id:'online',label:'Online',value:c.online.active?'Active room':'Available',detail:c.online.active?c.online.label:'Rooms, ranked play and competition remain optional.'},
      {id:'library',label:'Library',value:c.library.total+' saved',detail:c.library.needsReview?c.library.needsReview+' saved game'+(c.library.needsReview===1?' needs':'s need')+' review.':c.library.studies+' saved '+(c.library.studies===1?'study':'studies')+'.'}
    ];
  }
  function summary(input={}){
    const c=context(input),next=primary(input);
    return {
      version:VERSION,
      primary:next,
      stages:stages(input),
      threads:threads(input),
      metrics:{
        learning:c.learning.evidenced?c.learning.average:null,
        evidencedSkills:c.learning.evidenced,
        totalSkills:c.learning.skills,
        reviews:n(c.journey.review?.pending)+n(c.journey.review?.critical)+c.library.needsReview,
        practice:Math.max(n(c.journey.training?.due)+n(c.journey.training?.customDue),n(c.learning.due)),
        saved:c.library.total
      },
      context:c
    };
  }
  return Object.freeze({VERSION,learning,context,primary,stages,threads,summary});
});
