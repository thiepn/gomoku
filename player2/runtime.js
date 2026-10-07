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
  function ensureNav(){
    const nav=$('v92Primary')?.querySelector('.v92-nav-main');if(!nav)return false;
    if(!$('pj2HomeNav')){
      const b=document.createElement('button');b.id='pj2HomeNav';b.className='v92-nav-btn pj2-home-nav';b.type='button';b.textContent='Home';b.setAttribute('aria-current','page');b.onclick=()=>showHome(true);nav.prepend(b);
    }
    return true;
  }
  function ensureHome(){
    if($('pj2Home'))return $('pj2Home');
    const main=$('mainContent')||document.querySelector('main[aria-label="Gomoku Studio workspace"]');if(!main)return null;
    const home=document.createElement('section');home.id='pj2Home';home.setAttribute('aria-labelledby','pj2Title');
    home.innerHTML=`<div class="pj2-hero"><div><p class="eyebrow">GOMOKU 2.0 · YOUR JOURNEY</p><h1 id="pj2Title">Play. Review. Learn. Practice. Repeat.</h1><p>One next action across the full training system. Every recommendation comes from your existing local evidence.</p></div><div class="pj2-version">PLAYER JOURNEY 2.0</div></div>
      <section class="pj2-next" aria-labelledby="pj2NextTitle"><div><span>YOUR NEXT MOVE</span><h2 id="pj2NextTitle">Continue</h2><p id="pj2NextDetail"></p><small id="pj2NextSource"></small></div><button class="pj2-primary" id="pj2Primary" type="button">Continue</button></section>
      <div class="pj2-metrics" aria-label="Player evidence summary"><div><strong id="pj2Skill">—</strong><span>learning evidence</span></div><div><strong id="pj2Review">0</strong><span>review waiting</span></div><div><strong id="pj2Practice">0</strong><span>practice due</span></div><div><strong id="pj2Saved">0</strong><span>saved</span></div></div>
      <section class="pj2-section"><div class="pj2-section-head"><div><p class="eyebrow">IMPROVEMENT LOOP</p><h2>One cycle, four jobs.</h2></div><p>Specialist tools stay available, but the loop decides what deserves attention next.</p></div><div class="pj2-stage-grid" id="pj2Stages"></div></section>
      <section class="pj2-section"><div class="pj2-section-head"><div><p class="eyebrow">CURRENT THREADS</p><h2>Keep the rest of your game connected.</h2></div><p>Openings, competition, online play and your archive remain part of the same player history.</p></div><div class="pj2-thread-grid" id="pj2Threads"></div></section>
      <p class="pj2-footnote">Scores shown here summarize existing learning evidence. They are not Elo, Dan rank, win probability or an official rating.</p>`;
    main.insertAdjacentElement('beforebegin',home);
    $('pj2Primary').onclick=()=>route(last?.primary?.id);
    return home;
  }
  function markHome(active){
    document.body.dataset.pj2Route=active?'home':'app';
    const hb=$('pj2HomeNav');if(hb)hb.setAttribute('aria-current',active?'page':'false');
    if(active)for(const b of document.querySelectorAll('#v92Primary [data-v92-route]'))b.setAttribute('aria-current','false');
  }
  function showHome(scroll=false){
    ensureNav();ensureHome();markHome(true);refresh();if(scroll)window.scrollTo({top:0,behavior:'auto'});
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
  function card(row,kind){
    const b=document.createElement('button');b.type='button';b.className=kind==='stage'?'pj2-stage':'pj2-thread';b.dataset.pj2Route=row.id;
    const head=document.createElement('div'),title=document.createElement('b'),value=document.createElement('strong'),detail=document.createElement('p');
    title.textContent=row.label;value.textContent=row.value;detail.textContent=row.detail;head.append(title,value);b.append(head,detail);b.onclick=()=>route(row.id);return b;
  }
  function render(summary){
    ensureNav();ensureHome();last=summary;
    $('pj2NextTitle').textContent=summary.primary.label;
    $('pj2NextDetail').textContent=summary.primary.detail;
    $('pj2NextSource').textContent='Based on '+summary.primary.source+' evidence';
    $('pj2Primary').textContent=summary.primary.label;
    $('pj2Skill').textContent=summary.metrics.learning===null?'Baseline':summary.metrics.learning+'%';
    $('pj2Review').textContent=String(summary.metrics.reviews);
    $('pj2Practice').textContent=String(summary.metrics.practice);
    $('pj2Saved').textContent=String(summary.metrics.saved);
    const stages=$('pj2Stages');stages.replaceChildren(...summary.stages.map(x=>card(x,'stage')));
    const threads=$('pj2Threads');threads.replaceChildren(...summary.threads.map(x=>card(x,'thread')));
    return summary;
  }
  function refresh(){
    const input=collect(),summary=Core.summary(input);render(summary);return summary;
  }
  function schedule(ms=40){clearTimeout(timer);timer=setTimeout(refresh,ms);}
  function boot(){
    if(!studio()||!$('v92Primary')||document.body.dataset.uiReady!=='true'){setTimeout(boot,40);return;}
    if(ready)return;ready=true;ensureNav();ensureHome();
    document.addEventListener('click',e=>{if(e.target?.closest?.('#v92Primary [data-v92-route]'))leaveHome();},true);
    for(const ev of ['gomoku:move','gomoku:result','gomoku:room','gomoku-course2-transfer-changed','gomoku-mistakes-changed'])window.addEventListener(ev,()=>schedule(60));
    window.addEventListener('storage',()=>schedule(80));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(80);});
    setInterval(()=>{if(document.body.dataset.pj2Route==='home')refresh();},1800);
    showHome(false);
  }
  window.GomokuPlayer2=Object.freeze({version:Core.VERSION,refresh,route,showHome,snapshot:()=>last?copy(last):null});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
