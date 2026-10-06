/* Gomoku 2.0 — Unified Player Journey composition layer. */
(()=>{
  'use strict';
  if(window.GomokuV2)return;
  const Core=window.GomokuV2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let snapshot=null,timer=0,lastKey='',home=null,homeButton=null;
  const studio=()=>window.GomokuStudio||null;
  const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
  function safe(fn,fallback=null){try{const v=fn?.();return v==null?fallback:v;}catch{return fallback;}}
  function inputs(){
    const api=studio();
    return {
      journey:safe(()=>api?.journey?.(),{}),
      learning:safe(()=>window.GomokuLearningV11?.snapshot?.(),{}),
      course:safe(()=>window.GomokuCourse2?.model?.(),{}),
      library:safe(()=>window.GomokuLibrary2?.snapshot?.(),{}),
      opening:safe(()=>window.GomokuOpening2?.snapshot?.(),{}),
      competitive:safe(()=>window.GomokuCompetitive2?.snapshot?.(),{}),
      online:safe(()=>window.GomokuOnline2?.snapshot?.(),{})
    };
  }
  function navClick(route){
    const b=document.querySelector('#v92Primary [data-v92-route="'+route+'"]');
    if(!b)return false;b.click();return true;
  }
  function leaveHome(){
    if(document.body.dataset.v2Route!=='home')return;
    delete document.body.dataset.v2Route;
    if(home)home.hidden=true;
    homeButton?.setAttribute('aria-current','false');
  }
  function showHome(scroll=true){
    ensure();
    document.body.dataset.v2Route='home';
    home.hidden=false;
    for(const b of document.querySelectorAll('#v92Primary [data-v92-route]'))b.setAttribute('aria-current','false');
    homeButton?.setAttribute('aria-current','page');
    refresh();
    if(scroll)window.scrollTo({top:0,behavior:'auto'});
    homeButton?.focus?.({preventScroll:true});
    return true;
  }
  function routeJourney(id){
    const api=studio();
    if(id==='continue-game'){leaveHome();return navClick('play');}
    if(id==='new-game'){leaveHome();navClick('play');setTimeout(()=>$('newBtn')?.click(),0);return true;}
    if(id==='resume-practice'){leaveHome();api?.resumePracticeSession?.();return true;}
    if(id==='online'){leaveHome();$('onlineBtn')?.click();return true;}
    if(id==='resume-review'){leaveHome();api?.resumeReview?.();return true;}
    if(id==='analyze-game'){leaveHome();api?.reviewGame?.();return true;}
    if(id==='review-critical'){leaveHome();api?.openReviewCoach?.();return true;}
    if(id==='train-due'){leaveHome();api?.startPracticeSession?.('weakness');return true;}
    if(id==='train-opening'){leaveHome();api?.openRepertoire?.();return true;}
    if(id==='train-new'){leaveHome();api?.openAcademy?.();return true;}
    leaveHome();return navClick('play');
  }
  function route(id){
    const api=studio();
    if(id==='home')return showHome();
    if(id==='play'||id==='improve'||id==='library'){leaveHome();return navClick(id);}
    if(id==='learning'){leaveHome();window.GomokuLearningV11?.runNext?.();return true;}
    if(id==='skills'){leaveHome();window.GomokuLearningV11?.openDashboard?.();return true;}
    if(id==='course'){
      const chapter=snapshot?.course?.next?.id;leaveHome();
      if(chapter)window.GomokuCourse2?.openChapter?.(chapter);else navClick('improve');return true;
    }
    if(id==='archive'){
      const p=snapshot?.library?.primary;leaveHome();
      if(p?.id&&window.GomokuLibrary2?.route)return window.GomokuLibrary2.route(p.id),true;
      return navClick('library');
    }
    if(id==='opening'){leaveHome();api?.openOpening?.();return true;}
    if(id==='online'){leaveHome();$('onlineBtn')?.click();return true;}
    if(id==='competition'){
      const c=snapshot?.competitive;leaveHome();
      if(c?.action==='next-game')return api?.nextCompetitiveGame?.(),true;
      if(c?.action==='resume-clock')return api?.resumeCompetitiveClock?.(),true;
      if(c?.action==='play')return navClick('play');
      api?.openCompetition?.();return true;
    }
    if(id==='stats'){leaveHome();api?.openStatistics?.();return true;}
    if(id?.startsWith('journey:'))return routeJourney(id.slice(8));
    return false;
  }
  function ensure(){
    const nav=$('v92Primary'),main=document.querySelector('main');
    if(!nav||!main)return null;
    const navMain=nav.querySelector('.v92-nav-main');
    if(navMain&&!$('v2HomeNav')){
      homeButton=document.createElement('button');homeButton.id='v2HomeNav';homeButton.type='button';homeButton.className='v92-nav-btn v2-home-nav';homeButton.dataset.v2Route='home';homeButton.textContent='Home';homeButton.setAttribute('aria-current','false');
      navMain.prepend(homeButton);homeButton.onclick=()=>showHome(true);
      nav.querySelectorAll('[data-v92-route]').forEach(b=>b.addEventListener('click',leaveHome,true));
    }else homeButton=$('v2HomeNav');
    if(!home){
      home=document.createElement('section');home.id='v2Home';home.className='v2-home';home.hidden=true;home.setAttribute('aria-labelledby','v2HomeTitle');
      home.innerHTML='<div class="v2-mast"><div><p class="v2-kicker">GOMOKU 2.0 · PLAYER JOURNEY</p><h2 id="v2HomeTitle">Your next move,<br>across the whole game.</h2><p>Play creates evidence. Review finds the lesson. Practice and study make it reusable.</p></div><div class="v2-board-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><span></span><b></b><em></em></div></div><article class="v2-next"><div class="v2-next-index">01</div><div class="v2-next-copy"><span>CONTINUE</span><h3 id="v2PrimaryTitle">Loading…</h3><p id="v2PrimaryDetail"></p></div><button type="button" class="v2-primary" id="v2Primary">Continue</button></article><div class="v2-layout"><section class="v2-session"><div class="v2-section-head"><div><span>02 · FOCUSED SESSION</span><h3>Thirty useful minutes.</h3></div><small>Uses the existing Journey planner</small></div><div id="v2Plan"></div></section><section class="v2-development"><div class="v2-section-head"><div><span>03 · DEVELOPMENT</span><h3>What your evidence says.</h3></div><button type="button" class="v2-link" data-v2-route="skills">Skill map</button></div><div class="v2-skill-line"><strong id="v2Mastered">0</strong><div><b>skills mastered</b><p id="v2LearningStatus"></p></div></div><div class="v2-development-next"><span>NEXT LEARNING TASK</span><b id="v2LearningTitle"></b><p id="v2LearningDetail"></p><button type="button" class="v2-link" data-v2-route="learning">Do this next →</button></div><div class="v2-course-line"><span id="v2CourseIndex">01</span><div><b id="v2CourseTitle">Course</b><p id="v2CourseDetail"></p></div><button type="button" class="v2-link" data-v2-route="course">Open chapter</button></div></section></div><section class="v2-around"><div class="v2-section-head"><div><span>04 · AROUND THE BOARD</span><h3>The rest of your game.</h3></div><button type="button" class="v2-link" data-v2-route="stats">Statistics</button></div><div class="v2-around-rows"><button type="button" data-v2-route="archive"><span>ARCHIVE</span><b id="v2ArchiveTitle"></b><small id="v2ArchiveDetail"></small></button><button type="button" data-v2-route="opening"><span>OPENINGS</span><b id="v2OpeningTitle"></b><small id="v2OpeningDetail"></small></button><button type="button" id="v2CompetitionRow" data-v2-route="competition"><span>COMPETITION</span><b id="v2CompetitionTitle"></b><small id="v2CompetitionDetail"></small></button><button type="button" data-v2-route="online"><span>ONLINE</span><b id="v2OnlineTitle"></b><small id="v2OnlineDetail"></small></button></div></section><p class="v2-footnote">2.0 composes existing evidence only. No new rating, mastery score, cloud account or hidden recommendation model is introduced.</p>';
      main.insertAdjacentElement('beforebegin',home);
      home.addEventListener('click',e=>{const b=e.target.closest('[data-v2-route]');if(b)route(b.dataset.v2Route);});
      $('v2Primary').onclick=()=>route($('v2Primary').dataset.v2Route);
    }
    return home;
  }
  function renderPlan(rows){
    const host=$('v2Plan');if(!host)return;host.replaceChildren();
    const tasks=Array.isArray(rows)&&rows.length?rows:[{id:'new-game',label:'Play',detail:'Start a game and review it afterward.',minutes:30}];
    tasks.forEach((task,i)=>{
      const b=document.createElement('button');b.type='button';b.className='v2-plan-row';b.dataset.v2Route='journey:'+task.id;
      b.innerHTML='<strong></strong><div><b></b><p></p></div><span>Open →</span>';
      b.querySelector('strong').textContent=String(task.minutes).padStart(2,'0')+'m';
      b.querySelector('b').textContent=task.label;b.querySelector('p').textContent=task.detail||'';host.append(b);
    });
  }
  function render(){
    if(!ensure())return null;
    snapshot=Core.model(inputs());
    const key=JSON.stringify(snapshot);
    if(key===lastKey)return snapshot;lastKey=key;
    $('v2PrimaryTitle').textContent=snapshot.primary.label;
    $('v2PrimaryDetail').textContent=snapshot.primary.detail;
    $('v2Primary').textContent=snapshot.primary.label;$('v2Primary').dataset.v2Route='journey:'+snapshot.primary.id;
    renderPlan(snapshot.plan);
    $('v2Mastered').textContent=snapshot.learning.mastered+' / '+(snapshot.learning.total||35);
    $('v2LearningStatus').textContent=snapshot.status.learning;
    $('v2LearningTitle').textContent=snapshot.learning.next?.title||snapshot.learning.focus;
    $('v2LearningDetail').textContent=snapshot.learning.next?.reason||'Complete lessons, clean practice and reviewed games to strengthen the model.';
    const course=snapshot.course.next;
    $('v2CourseIndex').textContent=course?String(course.id).padStart(2,'0'):'—';
    $('v2CourseTitle').textContent=course?.title||'Course ready';
    $('v2CourseDetail').textContent=course?(course.completion+'% chapter · '+course.skillScore+'% skill evidence · '+course.state):'Open Improve to begin the course.';
    $('v2ArchiveTitle').textContent=snapshot.library.primary?.label||'Open Library';
    $('v2ArchiveDetail').textContent=snapshot.status.archive+(snapshot.library.flagged?' · '+snapshot.library.flagged+' with key moments':'');
    $('v2OpeningTitle').textContent=snapshot.opening.primary?.label||'Opening study';
    $('v2OpeningDetail').textContent=snapshot.status.opening+' · '+snapshot.opening.position;
    const comp=snapshot.competitive;
    $('v2CompetitionTitle').textContent=comp.active?(comp.label||comp.progress?.label||'Continue match'):'Competitive play';
    $('v2CompetitionDetail').textContent=comp.active?(comp.detail||comp.progress?.score||'Competitive match in progress'):'Series, clocks and opening procedures.';
    $('v2OnlineTitle').textContent=snapshot.online.primary?.label||'Online competition';
    $('v2OnlineDetail').textContent=snapshot.online.identity+' · '+snapshot.online.room;
    return snapshot;
  }
  function refresh(){lastKey='';return render();}
  function schedule(ms=40){clearTimeout(timer);timer=setTimeout(refresh,ms);}
  function boot(){
    let tries=0;
    const mount=()=>{
      if(!window.GomokuStudio||!$('v92Primary')||document.body.dataset.uiReady!=='true'){
        if(++tries<400)setTimeout(mount,30);return;
      }
      ensure();refresh();
      for(const ev of ['gomoku:move','gomoku:result','gomoku:v97-status','gomoku:room','gomoku-mistakes-changed','gomoku-course2-transfer-changed'])window.addEventListener(ev,()=>schedule(30));
      window.addEventListener('storage',()=>schedule(80));
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(40);});
      const watch=new MutationObserver(()=>{if(document.body.dataset.v2Route==='home')schedule(60);});
      ['moveBadge','statusText','libraryCount'].forEach(id=>{const el=$(id);if(el)watch.observe(el,{childList:true,subtree:true,characterData:true});});
    };
    mount();
  }
  window.GomokuV2=Object.freeze({version:Core.VERSION,refresh,openHome:showHome,route,snapshot:()=>clone(snapshot)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
