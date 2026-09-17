/* Gomoku Studio / Tournament Table. Presentation only; no game or course data writes. */
(() => {
  'use strict';
  if (window.GomokuAppearance) return;
  const $ = id => document.getElementById(id);
  const icons = {
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon:'<path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"/>',
    play:'<path d="m9 5 10 7-10 7Z"/>',
    learn:'<path d="M3 5h6c2 0 3 1 3 2 0-1 1-2 3-2h6v14h-6c-2 0-3 1-3 2 0-1-1-2-3-2H3Z M12 7v14"/>',
    library:'<path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l4-1 3 15-4 1z"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
    review:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
    practice:'<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
    study:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6m-3-3h6"/>',
    undo:'<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
    focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    volume:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };
  const svg = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.arrow}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = (id, value) => { const el=$(id); if(el && el.textContent!==String(value)) el.textContent=String(value); };
  const go = id => { const el=$(id); if (el && !el.disabled) el.click(); };
  const chapters = [
    ['Seeing the Board','Read four directions. Find the win, then find the threat.','foundation'],
    ['Fours','Recognize, create, and answer the most forcing shapes.','foundation'],
    ['Threes','See which threes are live and how they grow into fours.','foundation'],
    ['Forks & Double Threats','Create two obligations with one well-placed stone.','tactics'],
    ['Defense','Stop immediate threats and build useful counterplay.','tactics'],
    ['Reading Sequences','Calculate forcing lines and check the defender’s replies.','tactics'],
    ['Shape & Positional Play','Connect efficiently and keep several directions open.','tactics'],
    ['Initiative & Move Priority','Understand whose threat matters first.','tactics'],
    ['Attack Construction','Build pressure that survives the best defense.','tactics'],
    ['Whole-Board Planning','Find the critical area and compare your plans.','advanced'],
    ['Openings & Early Play','Build flexible shapes and make a sound opening plan.','advanced'],
    ['Advanced Renju','Read forbidden moves, legal threats, and tactical exceptions.','advanced'],
    ['Expert Calculation','Compare candidates against their strongest replies.','advanced'],
    ['Full-Game Mastery','Bring every skill together in the final examination.','advanced']
  ];
  // Original vector diagrams are decorative chapter signatures, not puzzle positions.
  function diagram(n) {
    const shapes = [ [[1,3],[2,3],[3,3],[4,3]], [[2,2],[3,2],[4,2]], [[2,1],[3,2],[4,3]], [[2,2],[3,2],[4,2],[3,1],[3,3]], [[1,2],[2,2],[3,2]], [[1,1],[2,2],[3,3],[4,4]], [[2,2],[3,3],[4,2],[3,1]] ];
    let s='<svg viewBox="0 0 156 108" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".7" opacity=".25">';
    for(let i=0;i<7;i++) s+=`<path d="M${12+i*22} 10v88"/>`;
    for(let i=0;i<5;i++) s+=`<path d="M12 ${10+i*22}h132"/>`;
    s+='</g>';
    const ps=shapes[(n-1)%shapes.length];ps.forEach(([x,y],i)=>s+=`<circle cx="${12+x*22}" cy="${10+y*22}" r="8" fill="${i===ps.length-1?'var(--ui-accent)':'currentColor'}"/>`);
    s+='<circle cx="122" cy="32" r="7.5" fill="var(--card)" stroke="currentColor" stroke-width="1.2"/>';
    return s+'</svg>';
  }
  function report(n) {
    const api=window['GomokuCourseChapter'+n];
    try {
      const r=api?.report?.();if(!r)return null;
      const lessons=r.lessons||r.sections||[];
      const total=Number(r.totalTasks ?? lessons.reduce((s,l)=>s+Number(l.total||0),0));
      const done=Number(r.solved ?? r.completed ?? lessons.reduce((s,l)=>s+Number(l.done??l.solved??l.completed??0),0));
      return {total,done:Math.min(total,done),lessons:Number(r.totalLessons||lessons.length),complete:total>0&&done>=total};
    } catch { return null; }
  }
  function openChapter(n) {
    const api=window['GomokuCourseChapter'+n];
    const resume=$('ch'+n+'CourseCard')?.querySelector('.ch'+n+'-open');
    if(resume){resume.click();return;}
    if(api?.open) api.open(); else if(api?.openSection) api.openSection(0,0);
  }
  function arrangeCourseSources() {
    const home=$('v92ImproveHome');if(!home)return;
    let prev=null;
    for(let n=1;n<=14;n++) {
      const card=$('ch'+n+'CourseCard');if(!card)continue;
      card.classList.add('ui-source-course');
      if(card.parentElement!==home || (prev && prev.nextElementSibling!==card)) {
        if(prev)prev.insertAdjacentElement('afterend',card);else home.append(card);
      }
      prev=card;
    }
  }
  let filter='all', lastCourseSignature='', activeChapter=1;
  function updateCatalog(force=false) {
    const host=$('uiCourseGrid');if(!host)return;
    const rs=chapters.map((_,i)=>report(i+1));
    const sig=JSON.stringify(rs)+filter;
    if(!force&&sig===lastCourseSignature)return;
    lastCourseSignature=sig;
    const focusedChapter=host.contains(document.activeElement)?document.activeElement?.dataset?.openChapter:null;
    const done=rs.reduce((a,r)=>a+(r?.done||0),0), total=rs.reduce((a,r)=>a+(r?.total||0),0);
    activeChapter=rs.findIndex(r=>r&&!r.complete)+1;if(!activeChapter)activeChapter=1;
    text('uiCourseCount',`${chapters.length} chapters · ${total} tasks`);
    text('uiCourseProgress',`${done} / ${total} tasks complete`);
    text('uiContinueLabel',`${done?'Continue':'Start'} · ${chapters[activeChapter-1][0]}`);
    const meter=$('uiCourseMeter');meter.max=total||1;meter.value=done;
    host.innerHTML=chapters.map(([title,description,group],i)=>{
      const n=i+1,r=rs[i],hidden=filter!=='all'&&filter!==group;
      return `<article class="ui-course-tile" data-chapter="${n}" ${hidden?'hidden':''}><div class="ui-course-art">${diagram(n)}<span>${String(n).padStart(2,'0')}</span></div><div class="ui-course-copy"><p class="ui-kicker">${group==='foundation'?'FOUNDATIONS':group==='tactics'?'TACTICS & STRATEGY':'ADVANCED'}</p><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="ui-course-progress"><progress aria-label="Chapter ${n} progress" max="${r?.total||1}" value="${r?.done||0}"></progress><span>${r?r.done+' / '+r.total+' tasks':'Loading…'}</span></div><button class="ui-course-open" data-open-chapter="${n}" ${!r?'disabled':''} aria-label="${r?.complete?'Review':r?.done?'Continue':'Open'} chapter ${n}: ${esc(title)}">${r?.complete?'Review':r?.done?'Continue':'Open chapter'} ${svg('arrow')}</button></div></article>`;
    }).join('');
    if(focusedChapter)host.querySelector('[data-open-chapter="'+focusedChapter+'"]')?.focus({preventScroll:true});
    text('uiCourseVisible',`${chapters.filter(c=>filter==='all'||c[2]===filter).length} chapters`);
  }
  function buildLearning() {
    const home=$('v92ImproveHome');if(!home||$('uiLearning'))return;
    const learning=document.createElement('div');learning.id='uiLearning';
    learning.innerHTML=`<header class="ui-learn-heading"><div><p class="ui-kicker">THE STUDY ROOM</p><h2>Every move.<br>A little more understood.</h2><p>A complete path from seeing your first threat to reading the whole game.</p></div><div class="ui-learn-mark" aria-hidden="true">${diagram(6)}<span>SEE · READ · PLAY</span></div></header><div class="ui-learning-actions"><button data-ui-proxy="v92PracticeChoice">${svg('practice')}<span><b>Practice</b><small>Train your next skill</small></span>${svg('arrow')}</button><button data-ui-proxy="v92ReviewChoice">${svg('review')}<span><b>Review games</b><small>Understand your decisions</small></span>${svg('arrow')}</button><button data-ui-proxy="v92StudyChoice">${svg('study')}<span><b>Study a position</b><small>Explore the possibilities</small></span>${svg('arrow')}</button></div><section class="ui-curriculum"><div class="ui-curriculum-top"><div><p class="ui-kicker">THE GOMOKU COURSE</p><h3>From first principles to mastery.</h3><p id="uiCourseCount"></p></div><button class="ui-cta" id="uiContinueCourse"><span id="uiContinueLabel">Start the course</span>${svg('arrow')}</button></div><div class="ui-progress-strip"><span id="uiCourseProgress"></span><progress id="uiCourseMeter" aria-label="Overall course progress" max="655" value="0"></progress><button id="uiViewProgress">View practice progress ${svg('arrow')}</button></div><div class="ui-course-tools"><div class="ui-filters" role="group" aria-label="Filter chapters"><button data-course-filter="all" aria-pressed="true">All chapters</button><button data-course-filter="foundation" aria-pressed="false">Foundations</button><button data-course-filter="tactics" aria-pressed="false">Tactics & strategy</button><button data-course-filter="advanced" aria-pressed="false">Advanced</button></div><span id="uiCourseVisible" aria-live="polite"></span></div><div class="ui-course-grid" id="uiCourseGrid"></div><p class="ui-course-note">Every chapter is open. Follow the order, or go straight to the skill you need. Your existing progress is kept.</p></section>`;
    home.prepend(learning);
    home.classList.add('ui-catalog-ready');
    learning.addEventListener('click',e=>{
      const proxy=e.target.closest('[data-ui-proxy]');if(proxy){go(proxy.dataset.uiProxy);return;}
      const f=e.target.closest('[data-course-filter]');if(f){filter=f.dataset.courseFilter;learning.querySelectorAll('[data-course-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===f)));updateCatalog();return;}
      const c=e.target.closest('[data-open-chapter]');if(c)openChapter(Number(c.dataset.openChapter));
    });
    $('uiContinueCourse').onclick=()=>openChapter(activeChapter);
    $('uiViewProgress').onclick=()=>{const b=$('v11DevelopmentStrip')?.querySelector('button');b?.click();};
    arrangeCourseSources();updateCatalog();
  }
  function updateTheme() {
    const night=['night','dark'].includes(document.body.dataset.theme);
    const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=night?'#101713':'#192420';
    const b=$('uiThemeToggle');if(b){b.innerHTML=svg(night?'sun':'moon');b.setAttribute('aria-label',night?'Switch to daylight theme':'Switch to night theme');b.title=night?'Daylight theme':'Night theme';}
  }
  let lastGameSignature='';
  function updateMatch() {
    const api=window.GomokuStudio;if(!api||!$('uiMatchDesk'))return;
    const d=api.diagnostics?.();if(!d)return;
    const status=$('statusText')?.textContent||'';
    const signature=JSON.stringify([d.moves,d.mode,d.rule,d.ai,status]);if(signature===lastGameSignature)return;lastGameSignature=signature;
    text('uiGameMode',d.mode==='local'?'LOCAL MATCH':d.mode==='arena'?'ENGINE MATCH':d.mode==='study'?'STUDY BOARD':'COMPUTER MATCH');
    text('uiMatchNumber',`${String(d.moves||0).padStart(2,'0')} moves played`);
    const keys=['first','beg','club','mid','advanced','high','expert','maximum'];
    const level=keys.indexOf(d.ai?.level)+1;
    const bars=$('uiDifficultyMeter');if(bars)bars.innerHTML=keys.map((_,i)=>`<i class="${i<level?'is-filled':''}"></i>`).join('');
    const busy=$('spinner')&&!$('spinner').hidden;
    const review=$('uiReviewCurrent');if(review){review.disabled=d.moves<2||busy;review.title=d.moves<2?'Play at least two moves to review the game.':busy?'Wait for the engine to finish.':'Open Guided Review without changing this game.';}
    const records=$('uiRecentMoves');if(records){let moves=[];try{moves=api.exportGame()?.moves||[];}catch{}
      records.innerHTML=moves.length?moves.slice(-6).map((m,j)=>{const idx=typeof m==='number'?m:m.i,ply=moves.length-Math.min(6,moves.length)+j+1,coord=idx>=0?'ABCDEFGHJKLMNOP'[idx%15]+String(15-Math.floor(idx/15)):'Pass';return `<span><small>${ply}</small><i class="ui-stone ${(typeof m==='object'?m.color:ply%2?1:2)===1?'black':'white'}" aria-hidden="true"></i>${esc(coord)}</span>`;}).join(''):'<p>The move record begins with your first stone.</p>';
    }
    for(const id of ['blackPlayer','whitePlayer']){
      const p=$(id),sub=$(id==='blackPlayer'?'blackSub':'whiteSub')?.textContent||'';p?.classList.toggle('ui-active-player',/to play|to move|thinking/i.test(sub));
    }
  }
  function buildMatch() {
    const col=document.querySelector('.board-col'),panel=$('panel-play');if(!col||!panel)return;
    const players=document.querySelector('.players');if(players){const origin=players.parentElement;origin.classList.add('ui-player-origin');players.id='uiPlayers';col.querySelector('.board-top').insertAdjacentElement('afterend',players);}
    const stageTop=document.querySelector('.board-top');if(stageTop)stageTop.dataset.uiSection='table';
    const level=$('v85LevelCompact');if(level&&!$('uiDifficultyMeter')){const meter=document.createElement('div');meter.id='uiDifficultyMeter';meter.setAttribute('aria-hidden','true');level.insertAdjacentElement('afterend',meter);}
    const desk=document.createElement('section');desk.id='uiMatchDesk';desk.innerHTML=`<div class="ui-desk-heading"><span class="ui-kicker" id="uiGameMode">COMPUTER MATCH</span><span id="uiMatchNumber">00 moves played</span></div><h3>Game record.</h3><p>Your last six moves. Open a review to explore a different line.</p><div class="ui-mini-signature" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="ui-recent-heading">RECENT MOVES</div><div id="uiRecentMoves"></div><button id="uiReviewCurrent" class="ui-review-link" disabled>${svg('review')} Review this game ${svg('arrow')}</button><p class="ui-review-caption">Test alternatives and learn from each decision.</p>`;
    panel.append(desk);$('uiReviewCurrent').onclick=()=>window.GomokuReview?.open();
    const caption=document.querySelector('.caption');if(caption){const small=document.createElement('span');small.className='ui-table-signature';small.textContent='FIVE IN A ROW';caption.append(small);}
    const description=$('levelDescription');if(description){const wrapper=document.createElement('details');wrapper.className='ui-engine-explanation';wrapper.innerHTML='<summary>About this opponent</summary>';description.before(wrapper);wrapper.append(description);}
    updateMatch();
  }
  function decorateDialog(dialog) {
    if(dialog.dataset.uiDecorated)return;dialog.dataset.uiDecorated='true';
    if(/^ch\d+CourseDialog$/.test(dialog.id)){dialog.classList.add('ui-course-dialog');if(Number(dialog.id.match(/\d+/)[0])>=8)dialog.classList.add('ui-linear-course');}
    dialog.addEventListener('close',()=>{if(dialog.classList.contains('ui-course-dialog'))updateCatalog();});
  }
  let attempts=0;
  function mount() {
    if(!$('v111MenuBtn')||!$('v92ImproveHome')||!$('v93MobileMatchStrip')||!window.GomokuCourseChapter14){if(++attempts<300)setTimeout(mount,40);return;}
    document.body.classList.add('ui-studio');
    const header=document.querySelector('header.top'),nav=$('v92Primary'),tools=document.querySelector('.header-tools');
    header.insertBefore(nav,tools);
    const brand=document.querySelector('.brand');brand.querySelector('.logo-seal').innerHTML='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 2v36M20 2v36M32 2v36M2 8h36M2 20h36M2 32h36" fill="none" stroke="currentColor" opacity=".35"/><circle cx="8" cy="32" r="4.7" fill="currentColor"/><circle cx="20" cy="20" r="4.7" fill="currentColor"/><circle cx="32" cy="8" r="4.7" fill="currentColor"/></svg>';
    const mark=brand.querySelector('h1');mark.innerHTML='GOMOKU<span>STUDIO</span>';brand.querySelector('p').textContent='FIVE IN A ROW';
    for(const b of nav.querySelectorAll('[data-v92-route]')){b.dataset.uiIcon=b.dataset.v92Route;/* Keep text children: legacy label observers depend on textContent. */}
    $('v111MenuBtn').innerHTML=svg('menu')+'<span class="v111-menu-label">Menu</span>';
    const theme=document.createElement('button');theme.id='uiThemeToggle';theme.type='button';theme.className='icon-btn';tools.insertBefore(theme,$('v111MenuBtn'));
    theme.onclick=()=>{const select=$('themeSelect');if(!select)return;select.value=['night','dark'].includes(document.body.dataset.theme)?'paper':'night';select.dispatchEvent(new Event('change',{bubbles:true}));updateTheme();};
    const names={paper:'Daylight · birch',night:'Night · birch',slate:'Slate · ash'};
    for(const o of $('themeSelect')?.options||[])if(names[o.value])o.textContent=names[o.value];
    $('soundBtn').innerHTML=svg('volume');$('focusBtn').innerHTML=svg('focus');
    const menuTitle=$('v111MenuTitle');if(menuTitle)menuTitle.textContent='Your studio.';
    const menuIntro=$('v111MenuDialog')?.querySelector('.v111-menu-head p:last-child');if(menuIntro)menuIntro.textContent='Appearance, help, and the tools for a deeper game.';
    buildMatch();buildLearning();
    $('v92Primary').addEventListener('click',()=>{arrangeCourseSources();updateCatalog();});
    document.querySelectorAll('dialog').forEach(decorateDialog);
    const dialogs=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.tagName==='DIALOG')decorateDialog(node);});dialogs.observe(document.body,{childList:true});
    let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;updateMatch();});};
    const gameObserver=new MutationObserver(schedule);
    for(const id of ['statusText','moveBadge','blackSub','whiteSub','levelDescription'])if($(id))gameObserver.observe($(id),{childList:true,subtree:true,characterData:true});
    const themeObserver=new MutationObserver(updateTheme);themeObserver.observe(document.body,{attributes:true,attributeFilter:['data-theme']});
    updateTheme();document.body.dataset.uiReady='true';
    window.GomokuAppearance=Object.freeze({version:'1.0.0',refresh:()=>{arrangeCourseSources();updateCatalog(true);updateMatch();},courseSummary:()=>chapters.map((c,i)=>({chapter:i+1,title:c[0],...report(i+1)}))});
    setTimeout(()=>{arrangeCourseSources();updateCatalog();},1000);
  }
  mount();
})();
