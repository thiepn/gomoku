/* Gomoku 1.4 — Game Feel 2.0 browser runtime.
 * Additive interaction choreography. Existing v9.4 feedback remains the low-level layer.
 */
(()=>{
  'use strict';
  if(window.GomokuGameFeel2)return;
  const Core=window.GomokuGameFeel2Core;if(!Core)return;
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const shell=$('shell'),grid=$('boardGrid');if(!shell||!grid)return;
  let layer=null,outcomeBox=null,lastMove=null,lastResult=null,lastAction='',audio=null,toastTimer=0,moveBadgeValue='';
  const snap=()=>{try{return window.GomokuStudio?.exportGame?.()||{};}catch{return {};}};
  function ensure(){
    if(layer)return;
    layer=document.createElement('div');layer.id='gf2Layer';layer.className='gf2-layer';layer.setAttribute('aria-hidden','true');
    outcomeBox=document.createElement('div');outcomeBox.id='gf2Outcome';outcomeBox.className='gf2-outcome';outcomeBox.hidden=true;
    outcomeBox.innerHTML='<span id="gf2OutcomeKicker">GAME</span><strong id="gf2OutcomeTitle"></strong><small id="gf2OutcomeSub"></small>';
    layer.append(outcomeBox);shell.append(layer);
    decorateResult();
  }
  function center(i){
    const el=grid.querySelector('[data-i="'+i+'"]');if(!el)return null;
    const r=el.getBoundingClientRect(),s=shell.getBoundingClientRect();
    return {x:r.left-s.left+r.width/2,y:r.top-s.top+r.height/2};
  }
  function nodeAt(cls,i,extra=''){
    const p=center(i);if(!p)return null;const n=document.createElement('i');n.className=cls+(extra?' '+extra:'');
    n.style.left=p.x+'px';n.style.top=p.y+'px';layer.append(n);return n;
  }
  function recycle(n,ms){if(!n)return;setTimeout(()=>n.remove(),ms);}
  function bump(el,cls,ms=260){
    if(!el||reduced.matches)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),ms);
  }
  function impact(detail){
    ensure();const plan=Core.movePlan(detail,reduced.matches);lastMove={...plan,at:Date.now()};layer.dataset.lastMove=String(plan.point??'pass');
    if(plan.impact){
      const n=nodeAt('gf2-impact',plan.point,plan.origin==='engine'?'is-engine':'is-human');
      if(n){n.style.setProperty('--gf2-strength',String(plan.strength));recycle(n,720);}
      const core=nodeAt('gf2-impact-core',plan.point);recycle(core,360);
      bump(shell,'gf2-board-impact',180);
    }
    bump($('moveBadge'),'gf2-count-pop',220);
    requestAnimationFrame(syncTurn);
  }
  function syncTurn(){
    const black=$('blackPlayer'),white=$('whitePlayer'),bsub=$('blackSub')?.textContent||'',wsub=$('whiteSub')?.textContent||'';
    black?.classList.toggle('gf2-active-player',/to play/i.test(bsub));white?.classList.toggle('gf2-active-player',/to play/i.test(wsub));
    const thinking=!$('spinner')?.hidden;black?.classList.toggle('gf2-thinking-player',thinking&&/to play/i.test(bsub));white?.classList.toggle('gf2-thinking-player',thinking&&/to play/i.test(wsub));
  }
  function clearCelebration(){
    if(!layer)return;for(const el of layer.querySelectorAll('.gf2-win-point,.gf2-fleck'))el.remove();
    if(outcomeBox){outcomeBox.hidden=true;outcomeBox.dataset.kind='';}
    shell.classList.remove('gf2-win','gf2-loss','gf2-draw');
  }
  function result(detail={}){
    ensure();clearCelebration();const game=snap(),names={black:$('blackName')?.textContent||'Black',white:$('whiteName')?.textContent||'White'};
    const plan=Core.resultPlan(game,detail,reduced.matches),copy=Core.resultCopy(game,detail,names);plan.copy=copy;lastResult={...plan,at:Date.now()};
    layer.dataset.lastResult=copy.kind;outcomeBox.dataset.kind=copy.kind;outcomeBox.hidden=false;
    $('gf2OutcomeKicker').textContent=copy.kind==='win'?'VICTORY':copy.kind==='loss'?'GAME COMPLETE':copy.kind==='draw'?'DRAW':'RESULT';
    $('gf2OutcomeTitle').textContent=copy.title;$('gf2OutcomeSub').textContent=copy.reason+' · '+copy.moves+' moves';
    shell.classList.add(copy.kind==='win'?'gf2-win':copy.kind==='loss'?'gf2-loss':'gf2-draw');
    bump(outcomeBox,'gf2-outcome-in',680);
    if(!reduced.matches){
      plan.winLine.forEach((i,n)=>{const x=nodeAt('gf2-win-point',i);if(x){x.style.setProperty('--gf2-delay',(n*55)+'ms');recycle(x,1550);}});
      if(plan.celebrate){
        const anchor=plan.winLine[Math.floor(plan.winLine.length/2)]??lastMove?.point??112,p=center(anchor)||{x:shell.clientWidth/2,y:shell.clientHeight/2};
        for(const row of plan.particles){const f=document.createElement('i');f.className='gf2-fleck';f.style.left=p.x+'px';f.style.top=p.y+'px';f.style.setProperty('--dx',row.dx+'px');f.style.setProperty('--dy',row.dy+'px');f.style.setProperty('--delay',row.delay+'ms');f.style.setProperty('--size',row.size+'px');f.style.setProperty('--turn',row.turn+'deg');layer.append(f);recycle(f,1200+row.delay);}
      }
    }
    setTimeout(()=>{if(lastResult?.at&&Date.now()-lastResult.at>=560)outcomeBox.hidden=true;},820);
    setTimeout(()=>enrichResult(copy),0);
  }
  function decorateResult(){
    const card=$('resultDialog')?.querySelector('.result-card');if(!card||$('gf2ResultMeta'))return;
    const meta=document.createElement('div');meta.id='gf2ResultMeta';meta.className='gf2-result-meta';meta.setAttribute('aria-label','Game result summary');
    const actions=card.querySelector('.dialog-actions');actions?.insertAdjacentElement('beforebegin',meta);
  }
  function enrichResult(copy){
    decorateResult();if(!copy)return;
    if($('resTitle'))$('resTitle').textContent=copy.title;if($('resStamp'))$('resStamp').textContent=copy.stamp;
    const meta=$('gf2ResultMeta');if(meta){
      const chips=[copy.reason,copy.moves+' moves'];if(copy.side)chips.push('You played '+copy.side);
      meta.innerHTML=chips.map(x=>'<span>'+String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</span>').join('');
      meta.dataset.kind=copy.kind;
    }
  }
  function soundEnabled(){return !!$('soundChk')?.checked;}
  function microTone(kind){
    if(!soundEnabled())return;try{
      const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio=audio||new A();if(audio.state==='suspended')audio.resume().catch(()=>{});
      const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';
      const f=kind==='undo'?[190,145]:kind==='redo'?[145,190]:[165,215];o.frequency.setValueAtTime(f[0],t);o.frequency.exponentialRampToValueAtTime(f[1],t+.065);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.018,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.085);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.09);
      o.onended=()=>{try{o.disconnect();g.disconnect();}catch{}};
    }catch{}
  }
  function smallHaptic(ms=6){if(!soundEnabled()||!navigator.vibrate)return;try{navigator.vibrate(ms);}catch{}}
  function action(kind){
    ensure();lastAction=kind;layer.dataset.lastAction=kind;
    if(kind==='undo'){bump(shell,'gf2-rewind',240);microTone('undo');smallHaptic(5);}
    else if(kind==='redo'){bump(shell,'gf2-forward',240);microTone('redo');smallHaptic(5);}
    else if(kind==='reset'){clearCelebration();bump(shell,'gf2-reset',360);microTone('reset');smallHaptic(6);}
  }
  function toastPulse(){
    const t=$('toast'),msg=$('toastMsg')?.textContent?.trim();if(!t||!msg)return;
    clearTimeout(toastTimer);t.classList.remove('gf2-toast-bump');void t.offsetWidth;t.classList.add('gf2-toast-bump');toastTimer=setTimeout(()=>t.classList.remove('gf2-toast-bump'),280);
  }
  function boot(){
    ensure();syncTurn();
    window.addEventListener('gomoku:move',e=>impact(e.detail||{}));
    window.addEventListener('gomoku:result',e=>result(e.detail||{}));
    $('undoBtn')?.addEventListener('click',()=>setTimeout(()=>action('undo'),0));
    $('redoBtn')?.addEventListener('click',()=>setTimeout(()=>action('redo'),0));
    $('rematchBtn')?.addEventListener('click',()=>setTimeout(()=>action('reset'),0));
    $('newForm')?.addEventListener('submit',()=>setTimeout(()=>action('reset'),60));
    grid.addEventListener('pointerdown',e=>{const p=e.target?.closest?.('[data-i]');if(p&&!reduced.matches){p.classList.add('gf2-press');setTimeout(()=>p.classList.remove('gf2-press'),150);}},{passive:true});
    const turnObs=new MutationObserver(()=>requestAnimationFrame(syncTurn));for(const el of [$('blackSub'),$('whiteSub'),$('spinner'),$('statusText')])if(el)turnObs.observe(el,{attributes:true,childList:true,characterData:true,subtree:true});
    const toast=$('toastMsg');if(toast)new MutationObserver(toastPulse).observe(toast,{childList:true,characterData:true,subtree:true});
    const badge=$('moveBadge');if(badge){moveBadgeValue=badge.textContent;new MutationObserver(()=>{const next=badge.textContent;if(next!==moveBadgeValue){const before=moveBadgeValue;moveBadgeValue=next;bump(badge,'gf2-count-pop',220);if(/^0*0\D/.test(next)&&!/^0*0\D/.test(before))action('reset');}}).observe(badge,{childList:true,characterData:true,subtree:true});}
    reduced.addEventListener?.('change',()=>{if(reduced.matches)clearCelebration();});
  }
  window.GomokuGameFeel2=Object.freeze({version:Core.VERSION,snapshot:()=>({lastMove,lastResult,lastAction,reduced:reduced.matches}),clear:clearCelebration});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();