/* Gomoku 1.7 — Online Play 2.0 experience orchestration.
 * Existing room, ranked, tournament and community systems remain authoritative.
 */
(()=>{
  'use strict';
  if(window.GomokuOnline2)return;
  const Core=window.GomokuOnline2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let last=null,bodyObserver=null,hudObserver=null,queued=false;
  const bridge=()=>window.GomokuCompetitionBridge||null;
  function room(){try{return bridge()?.room?.()||null;}catch{return null;}}
  function focusTarget(el){
    if(!el)return;
    el.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    const f=el.matches?.('input,button,select,textarea')?el:el.querySelector?.('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
    setTimeout(()=>f?.focus?.({preventScroll:true}),0);
  }
  function route(id){
    if(id==='ranked')return focusTarget($('roomRankedPanel'));
    if(id==='competition')return focusTarget($('p8CompetitionPanel'));
    if(id==='private')return focusTarget($('roomCode'));
    if(id==='live')return focusTarget($('roomDirectory'));
  }
  function enhanceOnlineDesk(){
    const ranked=$('roomRankedPanel'),account=$('roomAccountPanel');if(!ranked||!account)return false;
    const content=$('workbenchContent');if(!content)return false;
    const title=$('workbenchTitle');if(title&&/online renju rooms/i.test(title.textContent||''))title.textContent='Play online';
    const intro=content.querySelector(':scope > p.muted');
    if(intro&&/ranked matchmaking/i.test(intro.textContent||''))intro.textContent='Choose ranked matchmaking, tournaments and challenges, a private room, or a live room. Every playable online game uses Renju rules.';
    let start=$('op2Start');
    if(!start){
      start=document.createElement('section');start.id='op2Start';
      const choices=Core.launcher();
      start.innerHTML='<div class="op2-head"><div><p class="eyebrow">ONLINE PLAY · 2.0</p><h3>How do you want to play?</h3></div><p>One doorway into the existing online systems.</p></div><div id="op2Choices">'+choices.map(x=>'<button type="button" data-op2-route="'+x.id+'"><b>'+x.title+'</b><span>'+x.detail+'</span></button>').join('')+'</div>';
      account.insertAdjacentElement('beforebegin',start);
      start.querySelectorAll('[data-op2-route]').forEach(b=>b.onclick=()=>route(b.dataset.op2Route));
    }
    const tool=document.querySelector('#v92ToolsDialog [data-tool="online"]');
    if(tool){
      const b=tool.querySelector('b'),span=tool.querySelector('span');
      if(b)b.textContent='Play online';
      if(span)span.textContent='Ranked, tournaments, challenges and private rooms.';
    }
    return true;
  }
  function ensureRoomContext(){
    const hud=$('roomMatchHud');if(!hud)return null;
    let el=$('op2RoomContext');
    if(!el){
      el=document.createElement('div');el.id='op2RoomContext';el.hidden=true;
      el.innerHTML='<span id="op2RoomKind">ONLINE</span><b id="op2RoomDetail"></b>';
      const anchor=$('roomInlineMeta')||hud.firstElementChild;
      anchor?.insertAdjacentElement('afterend',el);
    }
    if(!hudObserver){
      hudObserver=new MutationObserver(schedule);
      hudObserver.observe(hud,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-state']});
    }
    return el;
  }
  function ensurePostMeta(){
    const post=$('roomPostGame');if(!post)return null;
    let el=$('op2PostMeta');
    if(!el){
      el=document.createElement('div');el.id='op2PostMeta';el.hidden=true;
      const actions=post.querySelector('.room-postgame-actions');actions?.insertAdjacentElement('beforebegin',el);
    }
    return el;
  }
  function present(value=room()){
    enhanceOnlineDesk();
    const c=Core.context(value),post=Core.postGame(value),ctx=ensureRoomContext(),meta=ensurePostMeta();
    document.body.classList.toggle('op2-online',c.active);
    if(ctx){
      ctx.hidden=!c.active;
      if(c.active){$('op2RoomKind').textContent=c.eyebrow;$('op2RoomDetail').textContent=c.detail;}
    }
    if(meta){
      meta.hidden=!post;
      if(post)meta.textContent=post.eyebrow+' · '+post.detail;
    }
    last={context:c,post};
    return last;
  }
  function schedule(){
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;present();});
  }
  function boot(){
    enhanceOnlineDesk();present();
    bodyObserver=new MutationObserver(()=>{enhanceOnlineDesk();schedule();});
    bodyObserver.observe(document.body,{subtree:true,childList:true});
    for(const ev of ['online','offline','gomoku:move','gomoku:result'])window.addEventListener(ev,schedule);
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#onlineBtn,#roomPostRematch,#roomPostReview,#roomHudLeave,#roomPostLeave'))setTimeout(schedule,60);
    },true);
  }
  window.GomokuOnline2=Object.freeze({
    version:Core.VERSION,refresh:()=>present(),present,
    route,snapshot:()=>last?JSON.parse(JSON.stringify(last)):null
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();