/* Gomoku 1.6 — Competitive Play 2.0 orchestration.
 * Existing V9.7 competitive mechanics remain authoritative.
 */
(()=>{
  'use strict';
  if(window.GomokuCompetitive2)return;
  const Core=window.GomokuCompetitive2Core;if(!Core)return;
  const $=id=>document.getElementById(id);
  let last=null,timer=0,dialogObserver=null;
  function api(){return window.GomokuStudio||null;}
  function status(){try{return api()?.competitivePlay?.()||null;}catch{return null;}}
  function game(){try{return api()?.exportGame?.()||{};}catch{return {};}}
  function ensure(){
    const strip=$('v97MatchStrip');
    if(strip&&!$('cp2Series')){
      strip.classList.add('cp2-ready');
      const host=document.createElement('div');host.id='cp2Series';
      host.innerHTML='<strong id="cp2SeriesLabel"></strong><span id="cp2SeriesScore"></span><progress id="cp2SeriesProgress" max="1" value="0" aria-label="Competitive match progress"></progress>';
      strip.querySelector('.v97-match-copy')?.append(host);
    }
    const dialog=$('resultDialog');
    if(dialog&&!dialogObserver){
      dialogObserver=new MutationObserver(()=>{if(dialog.open)schedule(0);});
      dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
    }
  }
  function applyMatchStrip(model){
    const host=$('cp2Series');if(!host)return;
    host.hidden=!model;
    if(!model)return;
    $('cp2SeriesLabel').textContent=model.label;
    $('cp2SeriesScore').textContent=model.score;
    const p=$('cp2SeriesProgress');p.max=model.max;p.value=model.value;
    p.setAttribute('aria-label',model.label+' · '+model.score);
  }
  function applyResult(next,phase){
    const dialog=$('resultDialog'),rematch=$('rematchBtn'),review=$('resultReviewBtn'),box=$('pg2Summary');
    if(!dialog)return;
    const relevant=phase?.active&&phase.terminal;
    dialog.classList.toggle('cp2-series',!!relevant);
    rematch?.classList.toggle('cp2-primary',!!relevant);
    review?.classList.toggle('cp2-secondary',!!relevant);
    if(!relevant)return;
    // v1.5 owns the generic learning handoff. During a competitive series,
    // series continuity wins; review stays available as the secondary action.
    if(box){
      const eyebrow=$('pg2Eyebrow'),heading=$('pg2Heading'),detail=$('pg2Detail'),summary=$('pg2Status');
      if(eyebrow)eyebrow.textContent=next.eyebrow;
      if(heading)heading.textContent=next.action==='next-game'?'Continue the match':'Competitive match complete';
      if(detail)detail.textContent=next.detail;
      if(summary)summary.textContent=phase.done?'Series finished':'Series in progress';
    }
    if(rematch)rematch.textContent=next.label;
    if(review)review.textContent='Review this game';
    rematch?.classList.add('pg2-recommended');
    review?.classList.remove('pg2-recommended');
  }
  function render(){
    ensure();
    const s=status(),g=game(),phase=Core.phase(s,g),next=Core.next(s,g),progress=Core.progress(s,g);
    applyMatchStrip(progress);
    if(window.GomokuPostGame2&&g.terminal)window.GomokuPostGame2.refresh();
    applyResult(next,phase);
    last={phase,next,progress};
    return last;
  }
  function schedule(ms=30){clearTimeout(timer);timer=setTimeout(render,ms);}
  function boot(){
    ensure();render();
    for(const ev of ['gomoku:v97-status','gomoku:move','gomoku:result'])window.addEventListener(ev,()=>schedule(ev==='gomoku:result'?40:0));
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#rematchBtn,#resultReviewBtn'))schedule(80);
    },true);
  }
  window.GomokuCompetitive2=Object.freeze({
    version:Core.VERSION,refresh:render,
    snapshot:()=>last?JSON.parse(JSON.stringify(last)):null
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();