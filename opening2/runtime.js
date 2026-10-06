/* Gomoku 1.8 — Opening Study & Repertoire 2.0 composition layer. */
(()=>{
  'use strict';
  if(window.GomokuOpening2)return;
  const Core=window.GomokuOpening2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let observer=null,timer=0,lastKey='';
  function api(){return window.GomokuStudio||null;}
  function game(){try{return api()?.exportGame?.()||{};}catch{return {};}}
  function learning(){try{return window.GomokuLearningV11?.snapshot?.()||{};}catch{return {};}}
  function snapshot(){return Core.summary(game(),learning());}
  function scroll(node){
    if(!node)return false;
    node.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const focus=node.matches?.('button,input,select,a[href]')?node:node.querySelector?.('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]');
    setTimeout(()=>focus?.focus?.({preventScroll:true}),180);
    return true;
  }
  function ensure(){
    const explorer=$('openingExplorer'),content=$('workbenchContent'),dialog=$('workbenchDialog');
    if(!explorer||!content||!dialog?.open)return null;
    let home=$('os2Home');
    if(!home){
      home=document.createElement('section');home.id='os2Home';home.setAttribute('aria-labelledby','os2Title');
      home.innerHTML='<div class="os2-head"><div><p class="eyebrow">OPENING STUDY · 2.0</p><h3 id="os2Title">Study the opening with evidence.</h3><p>Concepts, source records and your own repertoire stay distinct—but start from one place.</p></div><button type="button" class="os2-skill" id="os2SkillMap">Opening skill map →</button></div><div class="os2-context"><b id="os2Position"></b><span id="os2Skills"></span></div><div class="os2-next"><div><span>NEXT OPENING ACTION</span><strong id="os2PrimaryTitle"></strong><p id="os2PrimaryDetail"></p></div><button type="button" class="btn" id="os2Primary"></button></div><div class="os2-grid" id="os2Grid"></div><p class="os2-evidence">Source frequencies and observed results are evidence about matching records, not theoretical move evaluations. Repertoire practice tests your saved branches only.</p>';
      content.prepend(home);
      $('os2Primary').onclick=()=>route($('os2Primary').dataset.route);
      $('os2SkillMap').onclick=()=>route('skills');
    }
    return home;
  }
  function route(id){
    if(id==='explorer')return scroll($('openingExplorer'));
    if(id==='lab')return scroll($('protocolSelect')?.closest('label')||$('openingBoard')||$('openingExplorer'));
    if(id==='database'){api()?.openDatabase?.();return true;}
    if(id==='repertoire'){api()?.openRepertoire?.();return true;}
    if(id==='concepts'){
      const d=$('workbenchDialog');if(d?.open)d.close();
      const direct=document.querySelector('[data-open-chapter="11"]');
      if(direct){direct.click();return true;}
      const chapter=window.GomokuCourseChapter11;
      if(chapter?.open){chapter.open();return true;}
      if(chapter?.openSection){chapter.openSection(0,0);return true;}
      return false;
    }
    if(id==='skills'){
      const d=$('workbenchDialog');if(d?.open)d.close();
      window.GomokuLearningV11?.openDashboard?.();return true;
    }
    return false;
  }
  function render(){
    const home=ensure();
    if(!home){lastKey='';return null;}
    const s=snapshot(),key=JSON.stringify([s.game.variant,s.game.moves,s.game.setup,s.skills.average,s.skills.evidenced,s.skills.due,s.primary.id]);
    if(key===lastKey&&$('os2Grid')?.children.length)return s;
    lastKey=key;
    $('os2Position').textContent=s.position;
    $('os2Skills').textContent=s.skillLabel;
    $('os2PrimaryTitle').textContent=s.primary.label;
    $('os2PrimaryDetail').textContent=s.primary.detail;
    const primary=$('os2Primary');primary.textContent=s.primary.label;primary.dataset.route=s.primary.id;
    const grid=$('os2Grid');grid.replaceChildren();
    for(const item of s.destinations){
      const b=document.createElement('button');b.type='button';b.className='os2-destination';b.dataset.route=item.id;
      b.innerHTML='<b></b><span></span>';b.querySelector('b').textContent=item.label;b.querySelector('span').textContent=item.detail;
      b.onclick=()=>route(item.id);grid.append(b);
    }
    return s;
  }
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(render,delay);}
  function boot(){
    observer=new MutationObserver(muts=>{
      if(muts.every(m=>m.target?.id==='os2Home'||m.target?.closest?.('#os2Home')))return;
      schedule(20);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    window.addEventListener('gomoku:move',()=>schedule(20));
    window.addEventListener('gomoku-mistakes-changed',()=>schedule(40));
    document.addEventListener('click',e=>{if(e.target?.closest?.('#openingLabBtn,[data-tool="opening"]'))schedule(50);},true);
    // Opening Lab can also be invoked through the public API/command palette, which
    // does not necessarily produce a click mutation we own. Keep the composition
    // layer self-healing while that workbench is actually open.
    setInterval(()=>{if($('workbenchDialog')?.open&&$('openingExplorer'))render();},400);
    schedule();
  }
  window.GomokuOpening2=Object.freeze({version:Core.VERSION,refresh:render,route,snapshot});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
