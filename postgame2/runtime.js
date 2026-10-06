/* Gomoku 1.5 — Post-Game Experience 2.0 browser orchestration. */
(()=>{
  'use strict';
  if(window.GomokuPostGame2)return;
  const Core=window.GomokuPostGame2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let last=null,lastResult=null,observer=null;
  const game=()=>{try{return window.GomokuStudio?.exportGame?.()||{};}catch{return {};}};
  const review=()=>{try{return window.GomokuStudio?.reviewReport?.()||{};}catch{return {};}};
  function ensure(){
    const dialog=$('resultDialog'),card=dialog?.querySelector('.result-card'),actions=card?.querySelector('.dialog-actions');
    if(!card||!actions)return null;
    let box=$('pg2Summary');
    if(!box){
      box=document.createElement('section');box.id='pg2Summary';box.setAttribute('aria-label','Post-game next step');
      box.innerHTML='<span class="pg2-eyebrow" id="pg2Eyebrow">NEXT USEFUL STEP</span><strong id="pg2Heading"></strong><p id="pg2Detail"></p><small id="pg2Status"></small>';
      actions.insertAdjacentElement('beforebegin',box);
    }
    if(!observer&&dialog){
      observer=new MutationObserver(()=>{if(dialog.open)refresh();});
      observer.observe(dialog,{attributes:true,attributeFilter:['open']});
    }
    return box;
  }
  function apply(view){
    const box=ensure();if(!box)return view;
    const reviewBtn=$('resultReviewBtn'),rematch=$('rematchBtn');
    $('pg2Eyebrow').textContent=view.next.eyebrow;
    $('pg2Heading').textContent=view.next.label;
    $('pg2Detail').textContent=view.next.detail;
    $('pg2Status').textContent=view.status+(view.moves?' · '+view.moves+' moves':'');
    box.dataset.state=view.review.state;box.hidden=false;
    reviewBtn?.classList.toggle('pg2-recommended',view.next.action==='review');
    rematch?.classList.toggle('pg2-recommended',view.next.action==='rematch');
    if(reviewBtn)reviewBtn.textContent=view.next.action==='review'?view.next.label:'Review anyway';
    if(rematch)rematch.textContent=view.next.action==='rematch'?'Play another · swap colors':'Rematch · swap colors';
    return view;
  }
  function present(result){
    lastResult=result||game().result||{};
    last=apply(Core.viewModel(game(),lastResult,review()));
    return last;
  }
  function refresh(){
    const g=game(),result=lastResult||g.result||{};
    last=apply(Core.viewModel(g,result,review()));
    return last;
  }
  function boot(){
    ensure();
    window.addEventListener('gomoku:result',e=>{lastResult=e.detail||{};setTimeout(()=>present(lastResult),0);});
    document.addEventListener('click',e=>{
      const b=e.target?.closest?.('#resultReviewBtn,#resultAnalyzeBtn,#resultCoachBtn');
      if(b)setTimeout(refresh,120);
    },true);
    refresh();
  }
  window.GomokuPostGame2=Object.freeze({version:Core.VERSION,present,refresh,snapshot:()=>last?JSON.parse(JSON.stringify(last)):null});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();