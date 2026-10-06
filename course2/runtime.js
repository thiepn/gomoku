/* Gomoku 1.2 — Course 2.0 runtime.
 * Guided journey + animated concept studio layered over the existing 14 chapters.
 */
(()=>{
  'use strict';
  if(window.GomokuCourse2)return;
  const Core=window.GomokuCourse2Core;if(!Core)return;
  const KEY='gomoku.course2.v1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduceMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dialog=null,activeChapter=1,sceneIndex=0,autoTimer=0,lastSignature='',refreshTimer=0,transferMisses=0;

  function readState(){
    try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch{return {};}
  }
  function writeState(next){try{localStorage.setItem(KEY,JSON.stringify(next));return true;}catch{return false;}}
  function transferEvents(){
    const rows=readState().events;
    return Array.isArray(rows)?rows.filter(x=>x&&Number.isInteger(Number(x.chapter))&&typeof x.correct==='boolean').slice(-500):[];
  }
  function recordTransfer(chapter,correct,assisted=false){
    const state=readState(),transfer=state.transfer&&typeof state.transfer==='object'?state.transfer:{},prior=transfer[chapter]||{},at=Date.now();
    transfer[chapter]={attempts:(Number(prior.attempts)||0)+1,correct:correct===true||(prior.correct===true),at};
    const events=Array.isArray(state.events)?state.events:[];
    events.push({version:1,chapter:Number(chapter),skillIds:Core.chapterSkills(chapter),correct:correct===true,assisted:assisted===true,at});
    state.transfer=transfer;state.events=events.slice(-500);writeState(state);
    window.dispatchEvent(new CustomEvent('gomoku-course2-transfer-changed',{detail:{chapter:Number(chapter),correct:correct===true,assisted:assisted===true}}));
  }
  function reports(){
    const out=[];
    for(let n=1;n<=14;n++){
      try{
        const r=window['GomokuCourseChapter'+n]?.report?.();if(!r)continue;
        const lessons=r.lessons||r.sections||[];
        const total=Math.max(0,Number(r.totalTasks??r.total??lessons.reduce((a,x)=>a+Number(x.total||0),0))||0);
        const done=Math.max(0,Math.min(total,Number(r.solved??r.completed??r.done??lessons.reduce((a,x)=>a+Number(x.done??x.solved??x.completed??0),0))||0));
        out.push({chapter:n,total,done});
      }catch{}
    }
    return out;
  }
  function learning(){try{return window.GomokuLearningV11?.snapshot?.()||{skills:[]};}catch{return {skills:[]};}}
  function model(){return Core.journey(learning(),reports());}
  function openChapter(n){
    const api=window['GomokuCourseChapter'+Number(n)];if(!api)return;
    if(typeof api.open==='function')return api.open();
    if(typeof api.openSection==='function')return api.openSection(0,0);
  }
  function actionLabel(row){
    if(row.state==='mastered')return 'Review chapter';
    if(row.state==='verify')return 'Verify transfer';
    if(row.state==='practice')return 'Practice chapter';
    return row.completion?'Continue chapter':'Start chapter';
  }
  function stateLabel(state){return ({learn:'Learn',practice:'Practice',verify:'Verify',mastered:'Mastered'})[state]||'Learn';}
  function journeyHost(){return $('v92ImproveHome')||$('panel-train');}
  function ensureJourney(){
    const host=journeyHost();if(!host)return null;
    let section=$('c20Journey');
    if(!section){
      section=document.createElement('section');section.id='c20Journey';section.className='c20-journey';
    }
    // The modern Improve host can be created after Course 2 boots on slower/mobile
    // clients. Never strand the journey in the hidden legacy training panel.
    if(!host.contains(section)){
      const curriculum=host.querySelector('.ui-curriculum');
      if(curriculum)curriculum.insertAdjacentElement('beforebegin',section);else host.append(section);
    }
    return section;
  }
  function renderJourney(){
    const section=ensureJourney();if(!section)return;
    const j=model(),state=readState(),passed=state.transfer||{},next=j.next;
    section.innerHTML=
      '<div class="c20-hero"><div><p class="c20-kicker">COURSE 2.0 · GUIDED JOURNEY</p><h3>Learn it. Retrieve it. Use it in a game.</h3><p>The full 14-chapter library stays open. This path simply shows the most useful next step and whether each chapter still needs learning, mixed practice, or real-game transfer.</p></div>'+
      '<div class="c20-hero-progress"><strong>'+j.mastered+' / 14</strong><span>chapters mastered</span><progress max="14" value="'+j.mastered+'" aria-label="'+j.mastered+' of 14 chapters mastered"></progress></div></div>'+
      '<article class="c20-next"><div class="c20-next-index">'+String(next.id).padStart(2,'0')+'</div><div class="c20-next-copy"><span>NEXT USEFUL CHAPTER · '+esc(stateLabel(next.state).toUpperCase())+'</span><h4>'+esc(next.title)+'</h4><p>'+esc(next.reason)+'</p><div class="c20-next-meta"><b>'+next.completion+'% course</b><b>'+next.skillScore+'% skill evidence</b>'+(next.due?'<b>'+next.due+' due</b>':'')+'</div></div><div class="c20-next-actions"><button type="button" class="c20-primary" data-c20-open="'+next.id+'">'+esc(actionLabel(next))+'</button><button type="button" class="c20-secondary" data-c20-demo="'+next.id+'">Watch concept</button></div></article>'+
      '<div class="c20-bands">'+['Foundations','Tactics','Strategy','Advanced'].map(b=>renderBand(b,j.chapters,passed)).join('')+'</div>'+
      '<div class="c20-library-link"><span>Prefer to browse freely? Every original lesson and task is still available below.</span><button type="button" id="c20Library">Full chapter library ↓</button></div>';
    section.querySelectorAll('[data-c20-open]').forEach(b=>b.onclick=()=>openChapter(Number(b.dataset.c20Open)));
    section.querySelectorAll('[data-c20-demo]').forEach(b=>b.onclick=()=>openDemo(Number(b.dataset.c20Demo)));
    $('c20Library').onclick=()=>document.querySelector('.ui-curriculum')?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'});
  }
  function renderBand(name,rows,passed){
    const items=rows.filter(x=>x.band===name);
    return '<section class="c20-band"><div class="c20-band-head"><h4>'+esc(name)+'</h4><span>'+items.filter(x=>x.state==='mastered').length+' / '+items.length+' mastered</span></div><div class="c20-path">'+items.map((x,i)=>{
      const transfer=passed[x.id]?.correct===true;
      return '<article class="c20-node" data-state="'+esc(x.state)+'"><button type="button" class="c20-node-main" data-c20-open="'+x.id+'"><span class="c20-node-number">'+String(x.id).padStart(2,'0')+'</span><span class="c20-node-copy"><b>'+esc(x.title)+'</b><small>'+esc(x.tagline)+'</small><em>'+esc(stateLabel(x.state))+' · '+x.skillScore+'% evidence'+(transfer?' · transfer check ✓':'')+'</em></span></button><button class="c20-node-demo" type="button" data-c20-demo="'+x.id+'" aria-label="Watch animated concept for '+esc(x.title)+'">▶</button>'+(i<items.length-1?'<i class="c20-connector" aria-hidden="true"></i>':'')+'</article>';
    }).join('')+'</div></section>';
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='c20ConceptDialog';dialog.className='c20-dialog';dialog.setAttribute('aria-labelledby','c20DialogTitle');
    dialog.innerHTML='<div class="c20-dialog-shell"><header class="c20-dialog-head"><div><p class="c20-kicker">ANIMATED CONCEPT</p><h2 id="c20DialogTitle">Course 2.0</h2><p id="c20DialogSub"></p></div><button type="button" class="c20-close" aria-label="Close concept">×</button></header><div class="c20-stage"><div class="c20-visual"><div class="c20-board-wrap"><div id="c20Board" class="c20-board" role="img"></div><svg id="c20Lines" class="c20-lines" viewBox="0 0 900 900" aria-hidden="true"></svg></div><div class="c20-scene-progress" id="c20SceneProgress"></div></div><div class="c20-copy"><span id="c20SceneEyebrow"></span><h3 id="c20SceneTitle"></h3><p id="c20SceneText"></p><div class="c20-scene-actions"><button type="button" id="c20Back">← Back</button><button type="button" id="c20Auto">Play animation</button><button type="button" id="c20Next" class="c20-primary">Next →</button></div><div id="c20Transfer" class="c20-transfer" hidden></div></div></div><footer class="c20-dialog-foot"><button type="button" id="c20OpenChapter">Open full chapter</button><span>Animated previews explain the idea; the original chapter still contains the full task set.</span></footer></div>';
    document.body.append(dialog);
    dialog.querySelector('.c20-close').onclick=closeDemo;
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeDemo();});
    dialog.addEventListener('click',e=>{if(e.target===dialog)closeDemo();});
    $('c20Back').onclick=()=>{stopAuto();if(sceneIndex>0){sceneIndex--;renderScene();}};
    $('c20Next').onclick=advanceScene;
    $('c20Auto').onclick=toggleAuto;
    $('c20OpenChapter').onclick=()=>{closeDemo();openChapter(activeChapter);};
    return dialog;
  }
  function closeDemo(){stopAuto();if(dialog?.open)dialog.close();}
  function openDemo(chapter){
    activeChapter=Number(chapter)||1;sceneIndex=0;
    const d=ensureDialog(),meta=Core.metadata(activeChapter);
    $('c20DialogTitle').textContent=String(activeChapter).padStart(2,'0')+' · '+meta.title;
    $('c20DialogSub').textContent=meta.tagline;
    $('c20Transfer').hidden=true;
    renderScene();
    if(!d.open)d.showModal();
    d.querySelector('.c20-close').focus();
  }
  function advanceScene(){
    stopAuto();const scenes=Core.demo(activeChapter);
    if(sceneIndex<scenes.length-1){sceneIndex++;renderScene();}else renderTransfer();
  }
  function renderScene(){
    const scenes=Core.demo(activeChapter),scene=scenes[sceneIndex];if(!scene)return;
    $('c20Transfer').hidden=true;
    const board=$('c20Board'),svg=$('c20Lines');board.replaceChildren();svg.replaceChildren();
    board.setAttribute('aria-label',scene.title+'. '+scene.text);
    const previous=sceneIndex>0?scenes[sceneIndex-1]:null;
    const previousStones=new Set((previous?.stones||[]).map(x=>x.x+','+x.y+':'+x.c));
    const marks=new Map((scene.marks||[]).map((x,i)=>[x.x+','+x.y,{kind:x.kind,order:i}]));
    const stones=new Map((scene.stones||[]).map(x=>[x.x+','+x.y,x.c]));
    for(let y=0;y<9;y++)for(let x=0;x<9;x++){
      const cell=document.createElement('span');cell.className='c20-cell';
      const mark=marks.get(x+','+y);if(mark){cell.dataset.mark=mark.kind;cell.style.setProperty('--c20-delay',(mark.order*.07)+'s');}
      const color=stones.get(x+','+y);if(color){const stone=document.createElement('i'),key=x+','+y+':'+color;stone.className='c20-stone '+(color===1?'black':'white')+' '+(previousStones.has(key)?'is-static':'is-new');cell.append(stone);}
      board.append(cell);
    }
    for(const [i,l] of (scene.lines||[]).entries()){
      const path=document.createElementNS('http://www.w3.org/2000/svg','line');
      path.setAttribute('x1',(l.a[0]+.5)*100);path.setAttribute('y1',(l.a[1]+.5)*100);
      path.setAttribute('x2',(l.b[0]+.5)*100);path.setAttribute('y2',(l.b[1]+.5)*100);
      path.setAttribute('class','c20-line '+(l.kind||'threat'));path.style.animationDelay=(.12+i*.08)+'s';svg.append(path);
    }
    $('c20SceneEyebrow').textContent='STEP '+(sceneIndex+1)+' OF '+scenes.length;
    $('c20SceneTitle').textContent=scene.title;$('c20SceneText').textContent=scene.text;
    const copy=document.querySelector('#c20ConceptDialog .c20-copy');if(copy&&!reduceMotion()){copy.classList.remove('is-entering');void copy.offsetWidth;copy.classList.add('is-entering');}
    $('c20Back').disabled=sceneIndex===0;
    $('c20Next').onclick=advanceScene;$('c20Next').disabled=false;
    $('c20Next').textContent=sceneIndex===scenes.length-1?'Transfer check →':'Next →';
    $('c20SceneProgress').innerHTML=scenes.map((_,i)=>'<i class="'+(i<=sceneIndex?'active':'')+'"></i>').join('');
  }
  function renderTransfer(){
    stopAuto();transferMisses=0;
    const t=Core.transfer(activeChapter),host=$('c20Transfer'),saved=readState().transfer?.[activeChapter];
    host.hidden=false;host.classList.remove('is-correct');
    host.innerHTML='<p class="c20-transfer-kicker">TRANSFER CHECK</p><h4>'+esc(t.prompt)+'</h4><div class="c20-transfer-choices">'+t.choices.map((x,i)=>'<button type="button" data-c20-choice="'+i+'">'+esc(x)+'</button>').join('')+'</div><p id="c20TransferFeedback" class="c20-transfer-feedback">'+(saved?.correct?'You have already solved this comprehension check. A clean retry still tests recall.':'Choose the principle that should survive outside the lesson.')+'</p>';
    host.querySelectorAll('[data-c20-choice]').forEach(b=>b.onclick=()=>answerTransfer(Number(b.dataset.c20Choice),t,b));
    $('c20Next').textContent='Transfer check';$('c20Next').disabled=true;
  }
  function finishTransfer(t,assisted){
    const host=$('c20Transfer'),burst=document.createElement('div');burst.className='c20-burst';burst.setAttribute('aria-hidden','true');
    burst.innerHTML=Array.from({length:8},(_,i)=>'<i style="--i:'+i+'"></i>').join('');host.append(burst);host.classList.add('is-correct');
    recordTransfer(activeChapter,true,assisted);try{navigator.vibrate?.(18);}catch{}
    $('c20TransferFeedback').textContent='Correct. '+t.why+(assisted?' You found it after a retry; come back later for a clean recall.':' Clean first-try recall recorded.');
    $('c20Next').disabled=false;$('c20Next').textContent='Replay concept';$('c20Next').onclick=()=>{sceneIndex=0;renderScene();};
    renderJourney();decorateCatalog();decorateChapterDialogs();
  }
  function answerTransfer(choice,t,button){
    const correct=choice===t.answer,host=$('c20Transfer'),buttons=[...host.querySelectorAll('[data-c20-choice]')];
    if(correct){buttons.forEach((b,i)=>{b.disabled=true;if(i===t.answer)b.dataset.result='correct';});finishTransfer(t,transferMisses>0);return;}
    transferMisses++;if(transferMisses===1)recordTransfer(activeChapter,false,false);
    button.disabled=true;button.dataset.result='wrong';button.classList.remove('is-shake');void button.offsetWidth;button.classList.add('is-shake');try{navigator.vibrate?.(12);}catch{}
    if(transferMisses<2){$('c20TransferFeedback').textContent='Not quite. Try one more answer before the explanation is revealed.';return;}
    buttons.forEach((b,i)=>{b.disabled=true;if(i===t.answer)b.dataset.result='correct';});
    $('c20TransferFeedback').textContent='The answer is highlighted. '+t.why+' Replay the concept, then try it clean later.';
    $('c20Next').disabled=false;$('c20Next').textContent='Replay concept';$('c20Next').onclick=()=>{sceneIndex=0;renderScene();};
    renderJourney();decorateCatalog();decorateChapterDialogs();
  }
  function stopAuto(){clearInterval(autoTimer);autoTimer=0;if($('c20Auto'))$('c20Auto').textContent='Play animation';}
  function toggleAuto(){
    if(autoTimer){stopAuto();return;}
    if(reduceMotion()){return;}
    $('c20Auto').textContent='Pause animation';
    autoTimer=setInterval(()=>{
      const scenes=Core.demo(activeChapter);
      if(sceneIndex<scenes.length-1){sceneIndex++;renderScene();}
      else{stopAuto();renderTransfer();}
    },1450);
  }

  function decorateCatalog(){
    document.querySelectorAll('#uiCourseGrid .ui-course-tile[data-chapter]').forEach(tile=>{
      if(tile.querySelector('.c20-tile-demo'))return;
      const n=Number(tile.dataset.chapter),copy=tile.querySelector('.ui-course-copy');if(!copy||!n)return;
      const b=document.createElement('button');b.type='button';b.className='c20-tile-demo';b.textContent='Visual concept';b.setAttribute('aria-label','Watch animated concept for chapter '+n);
      b.onclick=e=>{e.preventDefault();e.stopPropagation();openDemo(n);};copy.append(b);
    });
  }
  function decorateChapterDialogs(){
    const j=model(),byId=Object.fromEntries(j.chapters.map(x=>[x.id,x]));
    for(let n=1;n<=14;n++){
      const d=$('ch'+n+'CourseDialog');if(!d)continue;
      let bar=d.querySelector('.c20-checkpoint');
      if(!bar){bar=document.createElement('section');bar.className='c20-checkpoint';const head=d.querySelector('[class*="-head"]')||d.firstElementChild;head?.insertAdjacentElement('afterend',bar);}
      if(!bar)continue;
      const r=byId[n],saved=readState().transfer?.[n]?.correct===true;
      bar.dataset.state=r.state;
      bar.innerHTML='<div><span>MASTERY CHECKPOINT · '+esc(stateLabel(r.state).toUpperCase())+'</span><b>'+r.skillScore+'% skill evidence</b><small>'+r.completion+'% chapter · '+r.cleanEvidence.toFixed(1)+' clean · '+r.transferEvidence.toFixed(1)+' game transfer'+(saved?' · concept check ✓':'')+'</small></div><p>'+esc(r.reason)+'</p><div class="c20-checkpoint-actions"><button type="button" data-c20-dialog-demo="'+n+'">Animated concept</button><button type="button" data-c20-dialog-transfer="'+n+'">Transfer check</button></div>';
      bar.querySelector('[data-c20-dialog-demo]').onclick=()=>openDemo(n);
      bar.querySelector('[data-c20-dialog-transfer]').onclick=()=>{openDemo(n);sceneIndex=Core.demo(n).length-1;renderScene();renderTransfer();};
    }
  }
  function signature(){
    const j=model(),s=readState();
    return JSON.stringify({c:j.chapters.map(x=>[x.id,x.state,x.completion,x.skillScore,x.due]),t:s.transfer||{}});
  }
  function refresh(){
    const sig=signature();
    if(sig!==lastSignature){lastSignature=sig;renderJourney();}
    decorateCatalog();decorateChapterDialogs();
  }
  function schedule(ms=100){clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,ms);}
  const observer=new MutationObserver(muts=>{
    for(const m of muts)for(const node of m.addedNodes||[]){
      if(node?.nodeType!==1)continue;
      if(node.matches?.('.ui-curriculum,.ui-course-tile,dialog,[id$="CourseDialog"]')||node.querySelector?.('.ui-curriculum,.ui-course-tile,[id$="CourseDialog"]')){schedule();return;}
    }
  });
  function boot(){
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='gomoku.studio.academy.v4')schedule(20);});
    window.addEventListener('gomoku-mistakes-changed',()=>schedule(20));
    document.addEventListener('close',e=>{if(e.target?.id?.endsWith('CourseDialog'))schedule(20);},true);
    setInterval(()=>{if(document.body?.dataset?.v92Route==='improve'||document.querySelector('[id$="CourseDialog"][open]'))schedule(0);},2500);
    schedule(0);
  }
  window.GomokuCourse2=Object.freeze({
    version:Core.VERSION,
    model,
    refresh,
    openDemo,
    openChapter,
    transferState:()=>JSON.parse(JSON.stringify(readState().transfer||{})),
    attempts:()=>JSON.parse(JSON.stringify(transferEvents()))
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
