/* Gomoku 1.1 — Learning Intelligence runtime.
 * Uses existing local course, Academy, decision-practice and mistake evidence.
 */
(()=>{
  'use strict';
  if(window.GomokuLearningV11)return;
  const Core=window.GomokuLearningCore;if(!Core)return;
  const ACADEMY_KEY='gomoku.studio.academy.v4',COURSE2_KEY='gomoku.course2.v1';
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titleCase=s=>String(s||'').replaceAll('-',' ').replace(/\b\w/g,m=>m.toUpperCase());
  let snapshot=null,mistakes=[],refreshTimer=0,dialog=null,lastSignature='',mounted=false,pendingMistakeReload=false;
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
  function course2Attempts(){
    try{
      const raw=localStorage.getItem(COURSE2_KEY);if(!raw||raw.length>2000000)return [];
      const state=JSON.parse(raw),rows=Array.isArray(state?.events)?state.events:[];
      return rows.filter(x=>x&&typeof x.correct==='boolean'&&Array.isArray(x.skillIds)).slice(-500);
    }catch{return [];}
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
    if(p.type==='review')return 'Review a real game and retry a '+p.title.toLowerCase()+' decision without revealing the answer.';
    if(p.reason?.includes('Academy review'))return 'Retrieve the due '+p.title.toLowerCase()+' material before adding new examples.';
    return 'Use Weakness Review to retrieve '+p.title.toLowerCase()+' without a hint.';
  }
  function actionLabel(p){
    if(!p)return 'Start practice';
    if(p.type==='mistakes')return 'Review due positions';
    if(p.type==='course')return 'Continue chapter';
    if(p.type==='review')return 'Review a game';
    return p.reason?.includes('Academy review')?'Practice due review':'Practice weakness';
  }
  async function runPrescription(p){
    if(!p)return window.GomokuStudio?.startPracticeSession?.('weakness');
    if(p.type==='mistakes'&&window.GomokuTraining?.open){
      const ids=Array.isArray(p.mistakeIds)&&p.mistakeIds.length?p.mistakeIds:(snapshot?.dueMistakeIds||[]);
      if(ids.length)return window.GomokuTraining.open({ids});
    }
    if(p.type==='course'){
      const button=document.querySelector('[data-open-chapter="'+p.chapter+'"]');
      if(button)return button.click();
      const api=window['GomokuCourseChapter'+p.chapter];
      if(api?.open)return api.open();
      if(api?.openSection)return api.openSection(0,0);
    }
    if(p.type==='review'){
      if(window.GomokuStudio?.openReviewCenter)return window.GomokuStudio.openReviewCenter();
      const proxy=document.querySelector('[data-ui-proxy="v92ReviewChoice"]');if(proxy)return proxy.click();
    }
    const motif=Number.isInteger(p.practiceMotif)?p.practiceMotif:motifForSkill(p.skillId);
    return window.GomokuStudio?.startPracticeSession?.('weakness',motif===undefined||motif===null?{}:{motif});
  }
  function skillPrescription(id){
    return snapshot?.skills?.find(s=>s.id===id)?.recommendation||null;
  }
  function reviewPrescription(id){
    const p=skillPrescription(id);if(!p||p.type!=='review')return p;
    if(Number.isInteger(p.practiceMotif))return {...p,type:'practice',reason:'Apply this game finding in targeted Weakness Review'};
    return {...p,type:'course',reason:'Revisit the linked concept before your next game'};
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
        '<div><strong>'+s.dueReviews+'</strong><span>reviews due</span></div>'+
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
    summary.innerHTML='<div><strong>'+snapshot.summary.mastered+'</strong><span>Mastered</span></div><div><strong>'+snapshot.summary.strong+'</strong><span>Strong</span></div><div><strong>'+snapshot.summary.developing+'</strong><span>Developing</span></div><div><strong>'+snapshot.summary.dueReviews+'</strong><span>Due reviews</span></div>';
    body.append(summary);
    const byId=Object.fromEntries(snapshot.skills.map(s=>[s.id,s]));
    for(const group of snapshot.groups){
      const skills=snapshot.skills.filter(s=>s.group===group.id);if(!skills.length)continue;
      const section=document.createElement('section');section.className='li11-group';
      const average=Math.round(skills.reduce((a,s)=>a+s.score,0)/skills.length);
      section.innerHTML='<div class="li11-group-head"><h3>'+esc(group.title)+'</h3><span>'+average+'% average</span></div><div class="li11-skill-list">'+skills.map(s=>{
        const gaps=s.prerequisites.filter(id=>(byId[id]?.score||0)<38).map(id=>byId[id]?.title||id);
        const transfer=s.needsTransfer?'<span class="is-transfer">needs game transfer</span>':'';
        const gap=gaps.length?'<small class="li11-prereq">Build first: '+esc(gaps.slice(0,2).join(' · '))+'</small>':'';
        return '<article class="li11-skill" data-state="'+esc(s.state)+'"><div class="li11-skill-title"><b>'+esc(s.title)+'</b><span>'+s.score+'%</span></div><progress max="100" value="'+s.score+'" aria-label="'+esc(s.title)+' mastery '+s.score+' percent"></progress><div class="li11-skill-meta"><span>'+esc(titleCase(s.state))+'</span><span>'+s.evidence.toFixed(1)+' evidence</span><span>'+s.contexts+' context'+(s.contexts===1?'':'s')+'</span>'+(s.due?'<span class="is-due">'+s.due+' due</span>':'')+transfer+'</div>'+gap+'<button class="li11-skill-action" type="button" data-li11-skill="'+esc(s.id)+'">'+esc(actionLabel(s.recommendation))+'</button></article>';
      }).join('')+'</div>';
      body.append(section);
    }
    body.querySelectorAll('[data-li11-skill]').forEach(button=>button.onclick=()=>{const p=skillPrescription(button.dataset.li11Skill);if(p){d.close();runPrescription(p);}});
    if(!d.open)d.showModal();
    d.querySelector('.li11-close').focus();
  }
  function mountReviewPrescription(){
    const overview=$('rwOverview');if(!overview||!window.GomokuStudio?.reviewReport)return;
    let row=$('li11ReviewPrescription');
    let focus=[];try{focus=Core.reviewFocus(window.GomokuStudio.reviewReport());}catch{}
    if(!focus.length){row?.remove();return;}
    if(!row){row=document.createElement('div');row.id='li11ReviewPrescription';row.className='li11-review';const practice=overview.querySelector('.rw-practice');if(practice)practice.insertAdjacentElement('beforebegin',row);else overview.append(row);}
    const p=reviewPrescription(focus[0].id),sig=focus.map(x=>x.id+':'+x.count).join('|')+'|'+(p?.type||'')+'|'+(p?.score||0)+'|'+(p?.mistakeIds?.length||0);
    if(row.dataset.signature===sig)return;row.dataset.signature=sig;
    row.innerHTML='<span>LEARNING PRESCRIPTION</span><h4>This game points to '+esc(focus[0].title)+'.</h4><p>'+focus.map(x=>esc(x.title)).join(' · ')+'</p><small>Reviewed decisions feed the same mastery model as lessons and practice. Use the next action to close the loop.</small><div class="li11-review-actions"><button type="button" class="gr-btn" id="li11ReviewAction">'+esc(actionLabel(p))+'</button><button type="button" class="gr-link" id="li11ReviewMap">Skill map</button></div>';
    $('li11ReviewAction').onclick=()=>p&&runPrescription(p);$('li11ReviewMap').onclick=openDashboard;
  }
  async function refresh(reloadMistakes=false){
    clearTimeout(refreshTimer);
    if(reloadMistakes)mistakes=await readMistakes();
    const next=Core.analyze({course:courses(),academy:academy(),mistakes,course2:course2Attempts(),now:Date.now()});
    const signature=JSON.stringify({skills:next.skills.map(s=>[s.id,s.score,s.due,s.state]),summary:next.summary});
    snapshot=next;
    if(signature!==lastSignature){lastSignature=signature;renderHome();annotateChapters();}
    mountReviewPrescription();
    return snapshot;
  }
  function schedule(ms=120,reloadMistakes=false){
    pendingMistakeReload=pendingMistakeReload||reloadMistakes;
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{const reload=pendingMistakeReload;pendingMistakeReload=false;refresh(reload).catch(()=>{});},ms);
  }
  const observer=new MutationObserver(mutations=>{
    for(const m of mutations)for(const node of m.addedNodes||[]){
      if(node?.nodeType!==1)continue;
      if(node.matches?.('#uiLearning,#grDialog,#uiCourseGrid')||node.querySelector?.('#uiLearning,#grDialog,#uiCourseGrid')){schedule(120,false);return;}
    }
  });
  function boot(){
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('gomoku-mistakes-changed',()=>schedule(20,true));
    window.addEventListener('gomoku-course2-transfer-changed',()=>schedule(20,false));
    window.addEventListener('storage',e=>{if(e.key===ACADEMY_KEY||e.key===COURSE2_KEY)schedule(20,false);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(50,true);});
    setInterval(()=>{if(document.body?.dataset?.v92Route==='improve'||$('grDialog')?.open)schedule(0,false);},2500);
    schedule(0,true);
  }
  window.GomokuLearningV11=Object.freeze({
    version:Core.VERSION,
    snapshot:()=>snapshot?JSON.parse(JSON.stringify(snapshot)):null,
    refresh:()=>refresh(true),
    openDashboard,
    prescription:()=>snapshot?.prescriptions?.map(x=>({...x}))||[],
    runNext:()=>runPrescription(snapshot?.prescriptions?.[0])
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
