/* Gomoku 2.0 — Player Journey & Home 2.0 runtime. */
(()=>{
  'use strict';
  if(window.GomokuPlayer2)return;
  const Core=window.GomokuPlayer2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let last=null,timer=0,ready=false;
  const studio=()=>window.GomokuStudio||null;
  const copy=x=>{try{return JSON.parse(JSON.stringify(x));}catch{return null;}};
  function collect(){
    let journey=null,learning=null,library=null,opening=null,competitive=null,online=null,postgame=null;
    try{journey=studio()?.journey?.()||null;}catch{}
    try{learning=window.GomokuLearningV11?.snapshot?.()||null;}catch{}
    try{library=window.GomokuLibrary2?.snapshot?.()||window.GomokuLibrary2?.refresh?.()||null;}catch{}
    try{opening=window.GomokuOpening2?.snapshot?.()||null;}catch{}
    try{competitive=window.GomokuCompetitive2?.snapshot?.()||null;}catch{}
    try{online=window.GomokuOnline2?.snapshot?.()||null;}catch{}
    try{postgame=window.GomokuPostGame2?.snapshot?.()||null;}catch{}
    return {journey,learning,library,opening,competitive,online,postgame};
  }
  function ensureJourneyEntry(){
    const menu=$('v111MenuDialog'),actions=menu?.querySelector('.v111-menu-main');
    if(!actions)return false;
    if(!$('pj2JourneyTool')){
      const b=document.createElement('button');b.id='pj2JourneyTool';
      b.className='v111-menu-action';b.type='button';
      b.innerHTML='<b>Player journal</b><span>Your games, reviews and practice progress.</span>';
      b.onclick=()=>{if(menu.open)menu.close();showHome(true);};
      actions.append(b);
    }
    return true;
  }
  function ensureHome(){
    if($('pj2Home'))return $('pj2Home');
    const main=$('mainContent')||document.querySelector('main[aria-label="Gomoku Studio workspace"]');if(!main)return null;
    const home=document.createElement('section');home.id='pj2Home';home.setAttribute('aria-labelledby','pj2Title');
    home.innerHTML=`<header class="pj2-hero"><div><p class="eyebrow">YOUR GOMOKU JOURNAL</p><h1 id="pj2Title" tabindex="-1">Progress &amp; practice</h1></div><p class="pj2-intro">Look back at your games and choose what to work on next.</p></header>
      <section class="pj2-next" aria-labelledby="pj2NextTitle"><div><span>YOUR NEXT MOVE</span><h2 id="pj2NextTitle">Continue</h2><p id="pj2NextDetail"></p><small id="pj2NextSource"></small></div><button class="pj2-primary" id="pj2Primary" type="button">Continue</button></section>
      <div class="pj2-metrics" aria-label="Player evidence summary"><div><strong id="pj2Skill">—</strong><span>learning evidence</span></div><div><strong id="pj2Review">0</strong><span>review waiting</span></div><div><strong id="pj2Practice">0</strong><span>practice due</span></div><div><strong id="pj2Saved">0</strong><span>saved</span></div></div>
      <section class="pj2-section"><div class="pj2-section-head"><div><p class="eyebrow">IMPROVEMENT LOOP</p><h2>Play, review, improve.</h2></div><p>Specialist tools stay available, but the loop decides what deserves attention next.</p></div><div class="pj2-stage-grid" id="pj2Stages"></div></section>
      <section class="pj2-section"><div class="pj2-section-head"><div><p class="eyebrow">CURRENT THREADS</p><h2>Games and openings.</h2></div><p>Openings, competition, online play and your archive remain part of the same player history.</p></div><div class="pj2-thread-grid" id="pj2Threads"></div></section>
      <p class="pj2-footnote">Scores shown here summarize existing learning evidence. They are not Elo, Dan rank, win probability or an official rating.</p>`;
    main.insertAdjacentElement('beforebegin',home);
    $('pj2Primary').onclick=()=>route(last?.primary?.id);
    return home;
  }
  function markHome(active){
    document.body.dataset.pj2Route=active?'home':'app';
    const status=$('uiRouteStatus');if(active&&status)status.textContent='Player journal section';
    if(active)for(const b of document.querySelectorAll('#v92Primary [data-v92-route]'))b.setAttribute('aria-current','false');
  }
  function showHome(scroll=false){
    ensureJourneyEntry();if(!ensureHome())return;
    markHome(true);refresh(true);
    if(scroll){window.scrollTo({top:0,behavior:'auto'});$('pj2Title')?.focus({preventScroll:true});}
  }
  function leaveHome(){if(document.body.dataset.pj2Route==='home')markHome(false);}
  function clickRoute(name){
    leaveHome();const b=document.querySelector('#v92Primary [data-v92-route="'+name+'"]');if(b){b.click();return true;}return false;
  }
  function journeyRoute(id){
    const api=studio();const action=String(id||'').replace(/^journey:/,'');
    if(action==='resume-practice'){leaveHome();api?.resumePracticeSession?.();return true;}
    if(action==='online')return route('online');
    if(action==='resume-review'){leaveHome();clickRoute('improve');setTimeout(()=>api?.resumeReview?.(),0);return true;}
    if(action==='continue-game'||action==='play')return clickRoute('play');
    if(action==='analyze-game'){leaveHome();clickRoute('improve');setTimeout(()=>api?.reviewGame?.(false),0);return true;}
    if(action==='review-critical'){leaveHome();api?.openReviewCoach?.();return true;}
    if(action==='train-due'||action==='train'){return route('training');}
    if(action==='train-opening')return route('opening');
    if(action==='train-new'){leaveHome();api?.openAcademy?.();return true;}
    if(action==='new-game'){leaveHome();clickRoute('play');setTimeout(()=>$('newBtn')?.click(),0);return true;}
    if(action==='analyze'||action==='study'){return clickRoute('improve');}
    if(action==='library')return clickRoute('library');
    return false;
  }
  function route(id){
    if(!id)return false;
    if(String(id).startsWith('journey:'))return journeyRoute(id);
    const api=studio();
    if(id==='home'){showHome(true);return true;}
    if(id==='play')return clickRoute('play');
    if(id==='library')return clickRoute('library');
    if(id==='review-center'){leaveHome();api?.openReviewCenter?.();return true;}
    if(id==='learning-next'){leaveHome();window.GomokuLearningV11?.runNext?.();return true;}
    if(id==='training'){leaveHome();api?.openTrainingCenter?.();return true;}
    if(id==='opening'){leaveHome();api?.openOpening?.();return true;}
    if(id==='competitive'){leaveHome();api?.openCompetition?.();return true;}
    if(id==='online'){
      leaveHome();
      const snap=window.GomokuOnline2?.snapshot?.();
      if(window.GomokuOnline2?.route&&snap?.primary?.id){window.GomokuOnline2.route(snap.primary.id);return true;}
      $('onlineBtn')?.click();return true;
    }
    return false;
  }
  function text(el,value){const next=String(value??'');if(el&&el.textContent!==next)el.textContent=next;}
  function updateCard(b,row){
    b.dataset.pj2Route=row.id;
    text(b.querySelector('b'),row.label);text(b.querySelector('strong'),row.value);
    text(b.querySelector('p'),row.detail);
    b.onclick=()=>route(b.dataset.pj2Route);
  }
  function card(row,kind){
    const b=document.createElement('button');b.type='button';
    b.className=kind==='stage'?'pj2-stage':'pj2-thread';
    const head=document.createElement('div'),title=document.createElement('b'),value=document.createElement('strong'),detail=document.createElement('p');
    head.append(title,value);b.append(head,detail);updateCard(b,row);return b;
  }
  function reconcile(container,rows,kind){
    if(!container)return;
    const existing=new Map([...container.children].map(b=>[b.dataset.pj2Route,b]));
    rows.forEach((row,index)=>{
      const b=existing.get(row.id)||card(row,kind);
      if(existing.has(row.id))updateCard(b,row);
      if(container.children[index]!==b)container.insertBefore(b,container.children[index]||null);
      existing.delete(row.id);
    });
    for(const stale of existing.values())stale.remove();
  }
  function render(summary){
    ensureJourneyEntry();let home=ensureHome();last=summary;if(!home)return summary;
    const required=['pj2NextTitle','pj2NextDetail','pj2NextSource','pj2Primary','pj2Skill','pj2Review','pj2Practice','pj2Saved','pj2Stages','pj2Threads'];
    if(required.some(id=>!$(id))){home.remove();home=ensureHome();if(!home)return summary;}
    const put=(id,value)=>{const el=$(id);text(el,value);return el;};
    put('pj2NextTitle',summary.primary.label);
    put('pj2NextDetail',summary.primary.detail);
    put('pj2NextSource','Based on '+summary.primary.source+' evidence');
    put('pj2Primary',summary.primary.label);
    put('pj2Skill',summary.metrics.learning===null?'Baseline':summary.metrics.learning+'%');
    put('pj2Review',summary.metrics.reviews);
    put('pj2Practice',summary.metrics.practice);
    put('pj2Saved',summary.metrics.saved);
    reconcile($('pj2Stages'),summary.stages,'stage');
    reconcile($('pj2Threads'),summary.threads,'thread');
    return summary;
  }
  function specialistOpen(){return !!document.querySelector('dialog[open]');}
  function refresh(force=false){
    if(!force&&document.body.dataset.pj2Route==='home'&&specialistOpen())return last;
    const input=collect(),summary=Core.summary(input);render(summary);return summary;
  }
  function schedule(ms=40){clearTimeout(timer);timer=setTimeout(()=>refresh(),ms);}
  function boot(){
    if(!studio()||!$('v92Primary')||document.body.dataset.uiReady!=='true'){setTimeout(boot,40);return;}
    if(ready)return;ready=true;ensureJourneyEntry();ensureHome();
    document.addEventListener('click',e=>{if(e.target?.closest?.('#v92Primary [data-v92-route]'))leaveHome();},true);
    for(const ev of ['gomoku:move','gomoku:result','gomoku:room','gomoku-course2-transfer-changed','gomoku-mistakes-changed'])window.addEventListener(ev,()=>schedule(60));
    window.addEventListener('storage',()=>schedule(80));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(80);});
    setInterval(()=>{if(!document.hidden&&document.body.dataset.pj2Route==='home'&&!specialistOpen())refresh();},5000);
    // Preserve whichever normal route the user already selected.
    markHome(false);refresh(true);
  }
  window.GomokuPlayer2=Object.freeze({version:Core.VERSION,refresh,route,showHome,snapshot:()=>last?copy(last):null});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
