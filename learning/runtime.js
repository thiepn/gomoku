/* Gomoku 1.1 — Learning Intelligence runtime.
 * Uses existing local course, Academy, decision-practice and mistake evidence.
 */
(()=>{
  'use strict';
  if(window.GomokuLearningV11)return;
  const Core=window.GomokuLearningCore;if(!Core)return;
  const ACADEMY_KEY='gomoku.studio.academy.v4';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleCase=s=>String(s||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
  let snapshot=null,mistakes=[],refreshTimer=0,dialog=null,lastSignature='',mounted=false;
  const motifForSkill=id=>({
    'board-scan':0,'immediate-win':0,
    'broken-four':1,'closed-four':1,
    'threat-scan':2,'forced-defense':2,'counter-win':2,'remote-defense':2,
    'open-four':3,
    'double-threat':4,'four-three':4,
    'exact-five':5,'overline':5,'double-three-rule':5,'double-four-rule':5
  })[id];
  function academy(){
    try{
      const raw=localStorage.getItem(ACADEMY_KEY);
      if(!raw||raw.length>8000000)return {};
      const value=JSON.parse(raw);
      return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    }catch{return {};}
  }
  function courses(){
    const out=[];
    for(let n=1;n<=14;n++){
      try{
        const r=window['GomokuCourseChapter'+n]?.report?.();if(!r)continue;
        const lessons=r.lessons||r.sections||[];
        const total=Number(r.totalTasks??lessons.reduce((sum,x)=>sum+Number(x.total||0),0));
        const done=Number(r.solved??r.completed??lessons.reduce((sum,x)=>sum+Number(x.done??x.solved??x.completed??0),0));
        out.push({chapter:n,total:Math.max(0,total||0),done:Math.max(0,Math.min(total||0,done||0))});
      }catch{}
    }
    return out;
  }
  async function readMistakes(){
    try{const rows=await window.GomokuMistakes?.list?.();return Array.isArray(rows)?rows:[];}catch{return [];}
  }
  function strengthText(skill){
    if(!skill)return 'No learning evidence yet';
    const due=skill.due?(' · '+skill.due+' due'):'';
    return skill.score+'% · '+titleCase(skill.state)+due;
  }
  function prescriptionCopy(p){
    if(!p)return 'Complete a lesson or practice session to build a recommendation.';
    if(p.type==='mistakes')return 'Recall your saved '+p.title.toLowerCase()+' positions before adding new material.';
    if(p.type==='course')return 'Continue '+p.chapterTitle+' and then test the idea in mixed practice.';
    return 'Use Weakness Review to retrieve '+p.title.toLowerCase()+' without a hint.';
  }
  function actionLabel(p){
    if(!p)return 'Start practice';
    return p.type==='mistakes'?'Review due positions':p.type==='course'?'Continue chapter':'Practice weakness';
  }
  async function runPrescription(p){
    if(!p)return window.GomokuStudio?.startPracticeSession?.('weakness');
    if(p.type==='mistakes'&&snapshot?.dueMistakeIds?.length&&window.GomokuTraining?.open){
      return window.GomokuTraining.open({ids:snapshot.dueMistakeIds});
    }
    if(p.type==='course'){
      const button=document.querySelector('[data-open-chapter="'+p.chapter+'"]');
      if(button)return button.click();
      const api=window['GomokuCourseChapter'+p.chapter];
      if(api?.open)return api.open();
      if(api?.openSection)return api.openSection(0,0);
    }
    const motif=motifForSkill(p.skillId);
    return window.GomokuStudio?.startPracticeSession?.('weakness',motif===undefined?{}:{motif});
  }
  function homeHost(){
    return $('uiLearning')||$('v92ImproveHome')||document.querySelector('#panel-train');
  }
  function mountHome(){
    const host=homeHost();if(!host)return false;
    let section=$('v11LearningIntelligence');
    if(!section){
      section=document.createElement('section');section.id='v11LearningIntelligence';section.className='li11-home';
      const curriculum=host.querySelector('.ui-curriculum');
      if(curriculum)curriculum.insertAdjacentElement('beforebegin',section);else host.append(section);
    }
    mounted=true;return true;
  }
  function renderHome(){
    if(!snapshot||!mountHome())return;
    const s=snapshot.summary,p=snapshot.prescriptions[0],focus=snapshot.focus;
    const priorities=snapshot.prescriptions.slice(0,3);
    const section=$('v11LearningIntelligence');
    section.innerHTML='<div class="li11-head"><div><p class="li11-kicker">LEARNING INTELLIGENCE · 1.1</p><h3>Your next useful work.</h3><p>Course progress, clean practice, reviewed mistakes and recall history now contribute to one skill model.</p></div><button class="li11-map" type="button" id="li11OpenMap">Skill map →</button></div>'+
      '<div class="li11-metrics" aria-label="Learning summary">'+
        '<div><strong>'+s.mastered+'</strong><span>skills mastered</span></div>'+
        '<div><strong>'+s.dueMistakes+'</strong><span>mistakes due</span></div>'+
        '<div><strong>'+s.average+'%</strong><span>evidenced mastery</span></div>'+
      '</div>'+
      '<article class="li11-focus"><div class="li11-focus-score" aria-label="'+esc(strengthText(focus))+'"><strong>'+Number(focus?.score||0)+'</strong><span>/ 100</span></div><div class="li11-focus-copy"><span>FOCUS NOW</span><h4>'+esc(focus?.title||'Build your baseline')+'</h4><p>'+esc(prescriptionCopy(p))+'</p><small>'+esc(p?.reason||'Your first evidence will establish a baseline.')+'</small></div><button class="li11-primary" type="button" id="li11DoNext">'+esc(actionLabel(p))+'</button></article>'+
      '<div class="li11-priorities">'+priorities.map((x,i)=>'<button type="button" data-li11-priority="'+i+'"><span>'+esc(x.title)+'</span><b>'+x.score+'%</b><small>'+esc(x.reason)+'</small></button>').join('')+'</div>'+
      '<p class="li11-foot">A completed task is evidence of exposure, not automatic mastery. Mastery needs clean retrieval and transfer.</p>';
    $('li11OpenMap').onclick=openDashboard;
    $('li11DoNext').onclick=()=>runPrescription(snapshot.prescriptions[0]);
    section.querySelectorAll('[data-li11-priority]').forEach(b=>b.onclick=()=>runPrescription(snapshot.prescriptions[Number(b.dataset.li11Priority)]));
  }
  function annotateChapters(){
    if(!snapshot)return;
    document.querySelectorAll('#uiCourseGrid .ui-course-tile[data-chapter]').forEach(tile=>{
      const chapter=Number(tile.dataset.chapter),sum=Core.chapterSummary(snapshot,chapter);
      let badge=tile.querySelector('.li11-chapter-mastery');
      if(!badge){badge=document.createElement('span');badge.className='li11-chapter-mastery';tile.querySelector('.ui-course-progress')?.append(badge);}
      if(badge){badge.dataset.state=sum.state;badge.textContent=sum.score+'% skill evidence';badge.title='Learning Intelligence: '+titleCase(sum.state);}
    });
  }
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.id='li11SkillDialog';dialog.className='li11-dialog';dialog.setAttribute('aria-labelledby','li11DialogTitle');
    dialog.innerHTML='<div class="li11-dialog-head"><div><p class="li11-kicker">LEARNING INTELLIGENCE</p><h2 id="li11DialogTitle">Skill map</h2><p>Mastery combines course exposure with independent evidence from practice and your own reviewed games.</p></div><button type="button" class="li11-close" aria-label="Close skill map">×</button></div><div id="li11DialogBody"></div>';
    document.body.append(dialog);dialog.querySelector('.li11-close').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',()=>{});
    return dialog;
  }
  function openDashboard(){
    if(!snapshot)return;
    const d=ensureDialog(),body=$('li11DialogBody');body.replaceChildren();
    const summary=document.createElement('div');summary.className='li11-dialog-summary';
    summary.innerHTML='<div><strong>'+snapshot.summary.mastered+'</strong><span>Mastered</span></div><div><strong>'+snapshot.summary.strong+'</strong><span>Strong</span></div><div><strong>'+snapshot.summary.developing+'</strong><span>Developing</span></div><div><strong>'+snapshot.summary.dueMistakes+'</strong><span>Due</span></div>';
    body.append(summary);
    for(const group of snapshot.groups){
      const skills=snapshot.skills.filter(s=>s.group===group.id);if(!skills.length)continue;
      const section=document.createElement('section');section.className='li11-group';
      const average=Math.round(skills.reduce((a,s)=>a+s.score,0)/skills.length);
      section.innerHTML='<div class="li11-group-head"><h3>'+esc(group.title)+'</h3><span>'+average+'% average</span></div><div class="li11-skill-list">'+skills.map(s=>'<article class="li11-skill" data-state="'+esc(s.state)+'"><div class="li11-skill-title"><b>'+esc(s.title)+'</b><span>'+s.score+'%</span></div><progress max="100" value="'+s.score+'" aria-label="'+esc(s.title)+' mastery '+s.score+' percent"></progress><div class="li11-skill-meta"><span>'+esc(titleCase(s.state))+'</span><span>'+s.evidence.toFixed(1)+' evidence</span><span>'+s.confidence+'% confidence</span>'+(s.due?'<span class="is-due">'+s.due+' due</span>':'')+'</div></article>').join('')+'</div>';
      body.append(section);
    }
    if(!d.open)d.showModal();
    d.querySelector('.li11-close').focus();
  }
  function mountReviewPrescription(){
    const overview=$('rwOverview');if(!overview||!window.GomokuStudio?.reviewReport)return;
    let row=$('li11ReviewPrescription');
    let focus=[];try{focus=Core.reviewFocus(window.GomokuStudio.reviewReport());}catch{}
    if(!focus.length){row?.remove();return;}
    if(!row){row=document.createElement('div');row.id='li11ReviewPrescription';row.className='li11-review';const practice=overview.querySelector('.rw-practice');if(practice)practice.insertAdjacentElement('beforebegin',row);else overview.append(row);}
    row.innerHTML='<span>LEARNING PRESCRIPTION</span><h4>This game points to '+esc(focus[0].title)+'.</h4><p>'+focus.map(x=>esc(x.title)).join(' · ')+'</p><small>Verified mistake positions saved from this review automatically feed your Learn recommendations and recall schedule.</small>';
  }
  async function refresh(){
    clearTimeout(refreshTimer);
    const nextMistakes=await readMistakes();
    const next=Core.analyze({course:courses(),academy:academy(),mistakes:nextMistakes,now:Date.now()});
    const signature=JSON.stringify({skills:next.skills.map(s=>[s.id,s.score,s.due,s.state]),summary:next.summary});
    snapshot=next;mistakes=nextMistakes;
    if(signature!==lastSignature){lastSignature=signature;renderHome();annotateChapters();}
    mountReviewPrescription();
    return snapshot;
  }
  function schedule(ms=120){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(()=>{}),ms);
  }
  const observer=new MutationObserver(()=>schedule(180));
  function boot(){
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('gomoku-mistakes-changed',()=>schedule(20));
    window.addEventListener('storage',e=>{if(e.key===ACADEMY_KEY)schedule(20);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(50);});
    schedule(0);
  }
  window.GomokuLearningV11=Object.freeze({
    version:Core.VERSION,
    snapshot:()=>snapshot?JSON.parse(JSON.stringify(snapshot)):null,
    refresh,
    openDashboard,
    prescription:()=>snapshot?.prescriptions?.map(x=>({...x}))||[],
    runNext:()=>runPrescription(snapshot?.prescriptions?.[0])
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
