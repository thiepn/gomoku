/* Gomoku 1.7 — Online Competition 2.0 composition layer. */
(()=>{
  'use strict';
  if(window.GomokuOnline2)return;
  const Core=window.GomokuOnline2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let observer=null,lastKey='',timer=0;
  const bridge=()=>window.GomokuCompetitionBridge||null;
  function snapshot(){
    const b=bridge();
    return Core.summary(b?.account?.()||{connected:false,username:null},b?.room?.()||null);
  }
  function ensure(){
    const ranked=$('roomRankedPanel'),account=$('roomAccountPanel'),dialog=$('workbenchDialog');
    if(!ranked||!account||!dialog?.open)return null;
    dialog.classList.add('oc2-online');
    let home=$('oc2Home');
    if(!home){
      home=document.createElement('section');home.id='oc2Home';home.setAttribute('aria-labelledby','oc2Title');
      home.innerHTML='<div class="oc2-head"><div><p class="eyebrow">ONLINE COMPETITION · 2.0</p><h3 id="oc2Title">Play online</h3><p>One starting point for ranked, seasons, cups, rooms, history and player identity.</p></div><div class="oc2-context"><b id="oc2Identity"></b><span id="oc2Room"></span></div></div><div class="oc2-next"><div><span>NEXT ONLINE ACTION</span><strong id="oc2PrimaryTitle"></strong><p id="oc2PrimaryDetail"></p></div><button class="btn" id="oc2Primary"></button></div><div class="oc2-grid" id="oc2Grid"></div>';
      account.insertAdjacentElement('beforebegin',home);
      $('oc2Primary').onclick=()=>route($('oc2Primary').dataset.route);
    }
    return home;
  }
  function scrollToNode(node){
    if(!node)return false;
    node.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const target=node.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href]');
    setTimeout(()=>target?.focus?.({preventScroll:true}),180);
    return true;
  }
  function route(id){
    const s=snapshot(),dialog=$('workbenchDialog');
    if(id==='active-room'){
      if(dialog?.open)dialog.close();
      const board=$('boardGrid')||document.querySelector('.board-grid')||$('board');
      board?.focus?.({preventScroll:false});
      document.querySelector('.board-side')?.scrollIntoView({block:'start',behavior:'auto'});
      return true;
    }
    if(id==='ranked'){
      if(!s.context.rankedReady)return scrollToNode($('roomAccountPanel'));
      return scrollToNode($('roomRankedPanel'));
    }
    if(id==='competition'){
      if(!s.context.identityReady)return scrollToNode($('roomAccountPanel'));
      window.GomokuCompetition?.refresh?.();
      return scrollToNode($('p8CompetitionPanel')||$('roomRankedPanel'));
    }
    if(id==='rooms')return scrollToNode($('roomDetails')?.parentElement||$('roomHistoryList')?.closest('section')||$('roomDirectory')?.closest('section'));
    if(id==='identity'){
      if(s.context.identityReady&&window.GomokuCompetition?.openPlayerProfile)return window.GomokuCompetition.openPlayerProfile(s.context.username),true;
      return scrollToNode($('roomAccountPanel'));
    }
    if(id==='community'){
      if(s.context.identityReady&&window.GomokuCompetition?.openCommunity)return window.GomokuCompetition.openCommunity(),true;
      return scrollToNode($('roomAccountPanel'));
    }
    return false;
  }
  function render(){
    const home=ensure();
    if(!home){lastKey='';return null;}
    const s=snapshot(),key=JSON.stringify([s.context.connected,s.context.username,s.context.roomKind,s.context.roomId,s.context.spectator]);
    if(key===lastKey&&$('oc2Grid')?.children.length)return s;
    lastKey=key;
    $('oc2Identity').textContent=s.identity;
    $('oc2Room').textContent=s.room;
    $('oc2PrimaryTitle').textContent=s.primary.label;
    $('oc2PrimaryDetail').textContent=s.primary.detail;
    const primary=$('oc2Primary');primary.textContent=s.primary.label;primary.dataset.route=s.primary.id;
    const grid=$('oc2Grid');grid.replaceChildren();
    for(const item of s.destinations){
      const b=document.createElement('button');b.type='button';b.className='oc2-destination';b.dataset.route=item.id;b.dataset.locked=String(!!item.locked);
      b.innerHTML='<b></b><span></span>';b.querySelector('b').textContent=item.label;b.querySelector('span').textContent=item.detail;
      b.onclick=()=>route(item.id);grid.append(b);
    }
    return s;
  }
  function schedule(delay=0){clearTimeout(timer);timer=setTimeout(render,delay);}
  function boot(){
    observer=new MutationObserver(muts=>{
      if(muts.some(m=>m.target?.id==='oc2Home'||m.target?.closest?.('#oc2Home')))return;
      schedule(20);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#onlineBtn,[data-tool="online"]'))schedule(40);
    },true);
    for(const ev of ['gomoku:room','gomoku:result'])window.addEventListener(ev,()=>schedule(20));
    // Online can be opened through several mature launchers that do not all
    // originate from #onlineBtn. While its workbench is open, keep the
    // composition layer self-healing instead of relying on a particular click.
    setInterval(()=>{if($('workbenchDialog')?.open&&$('roomRankedPanel')&&$('roomAccountPanel'))render();},400);
    schedule();
  }
  window.GomokuOnline2=Object.freeze({version:Core.VERSION,refresh:render,route,snapshot});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();