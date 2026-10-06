/* Gomoku 1.7 — Competition Hub 2.0 routing layer. */
(()=>{
  'use strict';
  if(window.GomokuCompetitionHub2)return;
  const Core=window.GomokuCompetitionHub2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let dialog=null,last=null;
  function studio(){return window.GomokuStudio||null;}
  function bridge(){return window.GomokuCompetitionBridge||null;}
  function local(){try{return studio()?.competitivePlay?.()||null;}catch{return null;}}
  function online(){try{return bridge()?.room?.()||null;}catch{return null;}}
  function account(){try{return bridge()?.account?.()||{connected:false,username:null};}catch{return {connected:false,username:null};}}
  function ensure(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='ch2Dialog';
    dialog.innerHTML='<div class="ch2-shell"><header class="ch2-head"><div><p class="eyebrow">COMPETITION</p><h2>Choose where to compete</h2><p>Local matches, ranked play, tournaments and rooms use their existing rules and records.</p></div><button class="icon-btn" id="ch2Close" aria-label="Close competition hub">×</button></header><div class="ch2-body"><section class="ch2-current" id="ch2Current"></section><div class="ch2-grid" id="ch2Grid"></div><p class="ch2-note">Ranked, tournaments and verified challenges use the existing online account and server systems. Local competitive matches stay fully local.</p></div></div>';
    document.body.append(dialog);$('ch2Close').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',()=>dialog.close());
    return dialog;
  }
  function closeOtherDialogs(){
    document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==dialog)d.close();});
  }
  function openOnline(target='rooms'){
    dialog?.close();
    $('onlineBtn')?.click();
    let tries=0;
    const focus=()=>{
      const id=target==='ranked'?'roomRankedPanel':target==='tournaments'?'p8CompetitionPanel':target==='rooms'?'roomCode':null;
      const el=id&&$(id);
      if(el){
        if(el.tabIndex<0&&!['INPUT','BUTTON','SELECT','TEXTAREA'].includes(el.tagName))el.tabIndex=-1;
        el.scrollIntoView?.({block:'start'});
        el.focus?.({preventScroll:true});
        return;
      }
      if(++tries<30)setTimeout(focus,80);
    };
    if(target==='community'){
      let n=0;const go=()=>{if(window.GomokuCompetition?.openCommunity){window.GomokuCompetition.openCommunity();return;}if(++n<30)setTimeout(go,80);};go();return;
    }
    setTimeout(focus,40);
  }
  function openLocal(){
    dialog?.close();
    window.dispatchEvent(new Event('gomoku:v97-open'));
  }
  function returnCurrent(kind){
    dialog?.close();
    if(kind==='online')$('onlineBtn')?.click();
  }
  function action(id){
    if(id==='local')return openLocal();
    if(id==='ranked'||id==='tournaments'||id==='rooms'||id==='community')return openOnline(id);
  }
  function render(){
    ensure();
    const m=Core.model(account(),local(),online());last=m;
    const current=$('ch2Current'),c=m.current;
    current.innerHTML='<div><span>CURRENT</span><b>'+c.label+'</b><small>'+c.detail+'</small></div>';
    if(c.kind!=='none'){
      const b=document.createElement('button');b.className='btn';b.textContent=c.kind==='online'?'Open current room':'Return to match';b.onclick=()=>returnCurrent(c.kind);current.append(b);
    }
    const grid=$('ch2Grid');grid.replaceChildren();
    for(const card of m.cards){
      const b=document.createElement('button');b.type='button';b.className='ch2-card';b.dataset.id=card.id;b.disabled=!card.enabled;
      b.innerHTML='<b>'+card.title+'</b><span>'+card.detail+'</span>'+(card.badge?'<em>'+card.badge+'</em>':'');
      b.onclick=()=>action(card.id);grid.append(b);
    }
    return m;
  }
  function open(){
    ensure();closeOtherDialogs();render();dialog.showModal();dialog.querySelector('.ch2-card:not(:disabled)')?.focus({preventScroll:true});return true;
  }
  function installEntryPoints(){
    const legacy=$('competitionBtn');if(legacy){legacy.textContent='Competition';legacy.title='Open competition hub';}
    const tool=document.querySelector('#v92ToolsDialog [data-tool="competition"]');
    if(tool){const b=tool.querySelector('b'),s=tool.querySelector('span');if(b)b.textContent='Competition hub';if(s)s.textContent='Local matches, ranked, tournaments and rooms.';}
    // Capture before older target-level handlers so Competition has one front door.
    document.addEventListener('click',ev=>{
      const target=ev.target?.closest?.('#competitionBtn,#v92ToolsDialog [data-tool="competition"]');
      if(!target)return;
      ev.preventDefault();ev.stopImmediatePropagation();
      $('v92ToolsDialog')?.close();open();
    },true);
  }
  function boot(){
    if(!studio()||!bridge()){setTimeout(boot,80);return;}
    ensure();installEntryPoints();render();
    for(const ev of ['gomoku:v97-status','gomoku:move','gomoku:result'])window.addEventListener(ev,()=>{if(dialog?.open)render();});
    new MutationObserver(()=>{if(dialog?.open)render();}).observe(document.body,{attributes:true,attributeFilter:['data-v92-route']});
  }
  window.GomokuCompetitionHub2=Object.freeze({version:Core.VERSION,open,refresh:render,snapshot:()=>last?JSON.parse(JSON.stringify(last)):null});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();