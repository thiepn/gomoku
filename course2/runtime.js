/* Gomoku 1.2 — Course 2.0 runtime. */
(()=>{
  'use strict';
  if(window.GomokuCourse2)return;
  const Core=window.GomokuCourse2Core;if(!Core)return;
  const STORE='gomoku.course2.transfer.v1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog=null,active=null,frameIndex=0,mode='walkthrough',autoTimer=0,lastFrameStones=new Set(),assisted=false,attemptWrong=false,observer=null;
  function load(){try{return Core.normalize(JSON.parse(localStorage.getItem(STORE)||'null'));}catch{return Core.normalize(null);}}
  function save(state){try{localStorage.setItem(STORE,JSON.stringify(Core.normalize(state)));return true;}catch{return false;}}
  function stateSummary(){return Core.summary(load());}
  function recommendedChapter(){
    const p=window.GomokuLearningV11?.prescription?.()?.[0];
    if(Number.isInteger(Number(p?.chapter)))return Math.max(1,Math.min(14,Number(p.chapter)));
    const summary=stateSummary();return summary.rows.find(x=>!x.solved)?.chapter||1;
  }
  function ensureDialog(){
    if(dialog?.isConnected)return dialog;
    dialog=document.createElement('dialog');dialog.id='c2Dialog';dialog.className='c2-dialog';dialog.setAttribute('aria-labelledby','c2Title');
    dialog.innerHTML='<div class="c2-shell"><header class="c2-head"><div class="c2-head-copy"><span class="c2-kicker">COURSE 2.0 · 1.2</span><h2 id="c2Title">Animated concept</h2><p id="c2Subtitle">See the pattern move before you solve it.</p></div><button class="c2-close" type="button" aria-label="Close Course 2.0">×</button></header><div id="c2Body"></div></div>';
    document.body.append(dialog);dialog.querySelector('.c2-close').onclick=()=>close();
    dialog.addEventListener('cancel',()=>stopAuto());dialog.addEventListener('close',()=>stopAuto());
    return dialog;
  }
  function close(){stopAuto();dialog?.close();}
  function stopAuto(){clearInterval(autoTimer);autoTimer=0;}
  function coordSet(frame){
    const out=new Set();for(const x of frame.black||[])out.add(x+':1');for(const x of frame.white||[])out.add(x+':2');return out;
  }
  function linePoints(line){
    return (line||[]).map(coord=>{const p=Core.point(coord);if(!p)return '';return (50+p.x*100)+','+(850-p.y*100)}).filter(Boolean).join(' ');
  }
  function boardHTML(frame,{interactive=false,answers=[],clue=false}={}){
    const black=new Set(frame.black||[]),white=new Set(frame.white||[]),marks=new Set(frame.marks||[]),answerSet=new Set(answers||[]);
    const now=coordSet(frame),cells=[];
    for(let row=9;row>=1;row--)for(let col=0;col<9;col++){
      const coord=Core.COLS[col]+row,color=black.has(coord)?1:white.has(coord)?2:0,newStone=color&&!lastFrameStones.has(coord+':'+color);
      const stone=color?'<i class="c2-stone '+(color===1?'black':'white')+(newStone?' is-new':'')+'" aria-hidden="true"></i>':'';
      const mark=marks.has(coord)?'<span class="c2-mark" aria-hidden="true"></span>':'';
      const hint=clue&&answerSet.has(coord)?'<span class="c2-clue" aria-hidden="true"></span>':'';
      if(interactive){
        const occupied=!!color;
        cells.push('<button class="c2-cell c2-cell-button" type="button" data-c2-coord="'+coord+'" '+(occupied?'disabled':'')+' aria-label="'+(occupied?(coord+' occupied'):'Play '+coord)+'">'+stone+mark+hint+'</button>');
      }else cells.push('<div class="c2-cell" aria-hidden="true">'+stone+mark+hint+'</div>');
    }
    lastFrameStones=now;
    const points=linePoints(frame.line);
    const line=points?'<svg class="c2-line" viewBox="0 0 900 900" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+points+'"></polyline></svg>':'';
    return '<div class="c2-board-wrap"><div class="c2-board" role="'+(interactive?'grid':'img')+'" aria-label="'+(interactive?'Transfer challenge board':'Animated Gomoku teaching board')+'">'+cells.join('')+'</div>'+line+'</div>';
  }
  function openChapter(chapter){
    active=Core.chapter(chapter);if(!active)return;
    mode='walkthrough';frameIndex=0;assisted=false;attemptWrong=false;lastFrameStones=new Set();stopAuto();ensureDialog();
    renderWalkthrough();if(!dialog.open)dialog.showModal();
  }
  function renderWalkthrough(){
    if(!active)return;const f=active.frames[frameIndex],body=$('c2Body');if(!body)return;
    $('c2Title').textContent='Chapter '+active.chapter+' · '+active.title;
    $('c2Subtitle').textContent=active.summary;
    body.className='c2-stage';
    body.innerHTML='<section class="c2-board-pane">'+boardHTML(f)+'</section><section class="c2-copy"><span class="c2-step">STEP '+(frameIndex+1)+' / '+active.frames.length+'</span><h3>'+esc(active.title)+'</h3><p class="c2-teach">'+esc(f.copy)+'</p><div class="c2-coach"><b>COACH</b><p>'+esc(frameIndex===active.frames.length-1?'Now transfer the idea to a position that does not look exactly like the demonstration.':'Watch what changes on the board, then say the principle in your own words before moving on.')+'</p></div><div class="c2-progress">'+active.frames.map((_,i)=>'<i class="'+(i<=frameIndex?'on':'')+'"></i>').join('')+'</div><div class="c2-actions"><button type="button" id="c2Prev" class="btn ghost">Previous</button><button type="button" id="c2Replay" class="btn ghost">'+(autoTimer?'Pause':'Play animation')+'</button>'+(frameIndex===active.frames.length-1?'<button type="button" id="c2Next" class="btn c2-primary">Try transfer check</button>':'<button type="button" id="c2Next" class="btn c2-primary">Next</button>')+'</div></section>';
    $('c2Prev').disabled=frameIndex===0;$('c2Prev').onclick=()=>{stopAuto();frameIndex=Math.max(0,frameIndex-1);renderWalkthrough();};
    $('c2Replay').onclick=()=>toggleAuto();$('c2Next').onclick=()=>{stopAuto();if(frameIndex<active.frames.length-1){frameIndex++;renderWalkthrough();}else renderTransfer();};
  }
  function toggleAuto(){
    if(autoTimer){stopAuto();renderWalkthrough();return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){frameIndex=(frameIndex+1)%active.frames.length;renderWalkthrough();return;}
    if(frameIndex>=active.frames.length-1)frameIndex=0;
    renderWalkthrough();autoTimer=setInterval(()=>{if(!active||mode!=='walkthrough'){stopAuto();return;}if(frameIndex>=active.frames.length-1){stopAuto();renderWalkthrough();return;}frameIndex++;renderWalkthrough();},1250);
  }
  function renderTransfer({status='',kind='',clue=false}={}){
    if(!active)return;mode='transfer';stopAuto();lastFrameStones=new Set();
    const t=active.transfer,body=$('c2Body'),frame={black:t.black,white:t.white,marks:[],line:[]};
    $('c2Title').textContent='Transfer check · Chapter '+active.chapter;
    $('c2Subtitle').textContent='New position, same principle. Nothing is locked if you miss it.';
    body.className='c2-stage';
    body.innerHTML='<section class="c2-board-pane">'+boardHTML(frame,{interactive:true,answers:t.answers,clue})+'</section><section class="c2-copy"><div class="c2-transfer-copy"><span class="c2-step">TRANSFER · '+esc(active.title.toUpperCase())+'</span><h3>Can you retrieve it?</h3><p>'+esc(t.prompt)+'</p></div><div id="c2TransferStatus" class="c2-transfer-status '+esc(kind)+'">'+(status?esc(status):'Choose a point. Use the clue only if you need it; assisted solves still count, but carry less mastery evidence.')+'</div><div class="c2-actions"><button type="button" class="btn ghost" id="c2BackWalk">Watch again</button><button type="button" class="btn ghost" id="c2Clue">'+(clue?'Clue shown':'Show clue')+'</button><button type="button" class="btn c2-primary" id="c2Another">Another chapter</button></div></section>';
    body.querySelectorAll('[data-c2-coord]').forEach(b=>b.onclick=()=>answerTransfer(b.dataset.c2Coord));
    $('c2BackWalk').onclick=()=>{mode='walkthrough';frameIndex=0;lastFrameStones=new Set();renderWalkthrough();};
    $('c2Clue').onclick=()=>{assisted=true;renderTransfer({status:'The answer area is highlighted. Explain why that point matters before you tap it.',clue:true});};
    $('c2Another').onclick=()=>openLibrary();
  }
  function answerTransfer(coord){
    if(!active||mode!=='transfer')return;
    const t=active.transfer,correct=t.answers.includes(coord),at=Date.now();
    let s=load();s=Core.record(s,active.chapter,{correct,assisted,at});save(s);
    if(!correct){
      attemptWrong=true;renderTransfer({status:'Not quite. Re-run the chapter principle and scan the urgent lines before choosing again.',kind:'bad'});return;
    }
    const clean=!assisted&&!attemptWrong;
    renderTransfer({status:(clean?'Clean transfer. ':'Solved. ')+t.explain,kind:'good'});
    try{window.dispatchEvent(new CustomEvent('gomoku:course2-transfer',{detail:{chapter:active.chapter,skillId:active.skill,clean,at}}));}catch{}
    renderHome();decorateCourseSurfaces();
  }
  function openTransfer(chapter){active=Core.chapter(chapter);if(!active)return;mode='transfer';assisted=false;attemptWrong=false;ensureDialog();renderTransfer();if(!dialog.open)dialog.showModal();}
  function openLibrary(){
    active=null;mode='library';stopAuto();ensureDialog();const s=stateSummary();$('c2Title').textContent='Course 2.0 walkthroughs';$('c2Subtitle').textContent='All chapters remain open. Use the path when you want guidance, or jump directly to any concept.';
    const body=$('c2Body');body.className='c2-library';body.innerHTML='<div class="c2-library-intro"><span class="c2-kicker">ANIMATED COURSE</span><h3>See → retrieve → transfer.</h3><p>Each chapter adds a short animated explanation and one transfer check. These checks add independent evidence to Learning Intelligence; they do not replace the existing 655 course tasks.</p></div><div class="c2-grid">'+Core.CHAPTERS.map(ch=>{const row=s.rows.find(x=>x.chapter===ch.chapter);return '<button class="c2-card" type="button" data-c2-open="'+ch.chapter+'"><span class="c2-card-num">'+ch.chapter+'</span><span><b>'+esc(ch.title)+'</b><small>'+esc(ch.summary)+'</small></span><span class="c2-card-state">'+(row?.clean?'Clean':row?.solved?'Solved':row?.attempts?'Retry':'Watch')+'</span></button>';}).join('')+'</div>';
    body.querySelectorAll('[data-c2-open]').forEach(b=>b.onclick=()=>openChapter(Number(b.dataset.c2Open)));if(!dialog.open)dialog.showModal();
  }
  function homeHost(){return $('uiLearning')||$('v92ImproveHome')||document.querySelector('#panel-train');}
  function renderHome(){
    const host=homeHost();if(!host)return;let section=$('c2Home');
    if(!section){section=document.createElement('section');section.id='c2Home';section.className='c2-home';const anchor=$('v11LearningIntelligence');if(anchor)anchor.insertAdjacentElement('afterend',section);else host.prepend(section);}
    const s=stateSummary(),chapter=recommendedChapter(),ch=Core.chapter(chapter),row=s.rows.find(x=>x.chapter===chapter);
    section.innerHTML='<div class="c2-home-head"><div><span class="c2-kicker">COURSE 2.0 · V1.2</span><h3>Learn it by watching it move.</h3><p>Animated board explanations and transfer checks now sit on top of the full 14-chapter course.</p></div><button class="btn ghost c2-inline-launch" id="c2Browse">All walkthroughs →</button></div><div class="c2-home-metrics"><div><b>'+s.solved+' / '+s.total+'</b><span>transfer checks solved</span></div><div><b>'+s.clean+'</b><span>clean first-try transfers</span></div><div><b>Chapter '+chapter+'</b><span>recommended now</span></div></div><div class="c2-home-actions"><button class="btn" id="c2Watch">Watch · '+esc(ch.title)+'</button><button class="btn ghost" id="c2Check">'+(row?.solved?'Retry transfer':'Try transfer')+'</button></div>';
    $('c2Browse').onclick=openLibrary;$('c2Watch').onclick=()=>openChapter(chapter);$('c2Check').onclick=()=>openTransfer(chapter);
  }
  function chapterFromDialog(d){const m=/^ch(\d+)CourseDialog$/.exec(d?.id||'');return m?Number(m[1]):0;}
  function decorateDialog(d){
    const chapter=chapterFromDialog(d);if(!chapter||d.querySelector('[data-c2-dialog-launch]'))return;
    const head=d.querySelector('header,[class*="-head"]');if(!head)return;const btn=document.createElement('button');btn.type='button';btn.className='btn ghost c2-inline-launch';btn.dataset.c2DialogLaunch=String(chapter);btn.textContent='Animated concept';btn.onclick=e=>{e.preventDefault();e.stopPropagation();openChapter(chapter);};const close=head.querySelector('button[aria-label*="Close"],button[id*="Close"],.ch1-close,.ch2-close');if(close)head.insertBefore(btn,close);else head.append(btn);
  }
  function decorateCard(chapter){
    const card=$('ch'+chapter+'CourseCard');if(!card||card.querySelector('[data-c2-card-launch]'))return;
    const actions=card.querySelector('[class*="card-actions"],[class*="actions"]');if(!actions)return;const btn=document.createElement('button');btn.type='button';btn.className='btn ghost c2-inline-launch';btn.dataset.c2CardLaunch=String(chapter);btn.textContent='Watch concept';btn.onclick=e=>{e.preventDefault();e.stopPropagation();openChapter(chapter);};actions.append(btn);
    const row=stateSummary().rows.find(x=>x.chapter===chapter),badge=document.createElement('span');badge.className='c2-transfer-badge'+(row?.solved?' is-done':'');badge.textContent=row?.clean?'Transfer ✓ clean':row?.solved?'Transfer ✓':row?.attempts?'Transfer retry':'Transfer check';actions.append(badge);
  }
  function decorateCourseSurfaces(){
    for(let n=1;n<=14;n++)decorateCard(n);
    document.querySelectorAll('dialog[id$="CourseDialog"]').forEach(decorateDialog);
  }
  function boot(){
    renderHome();decorateCourseSurfaces();
    observer=new MutationObserver(()=>{clearTimeout(boot._t);boot._t=setTimeout(()=>{renderHome();decorateCourseSurfaces();},80);});
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('gomoku:course-progress',()=>setTimeout(()=>{renderHome();decorateCourseSurfaces();},40));
    window.addEventListener('storage',e=>{if(e.key===STORE){renderHome();decorateCourseSurfaces();}});
  }
  window.GomokuCourse2=Object.freeze({
    version:Core.VERSION,
    open:openChapter,
    transfer:openTransfer,
    library:openLibrary,
    summary:()=>JSON.parse(JSON.stringify(stateSummary())),
    evidence:()=>Core.evidence(load()),
    state:()=>JSON.parse(JSON.stringify(load()))
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
