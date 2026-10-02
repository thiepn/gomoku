/* P15 — Competitive Operations Console, Controlled Rollouts & Incident Drill Certification */
(() => {
  'use strict';
  if (window.GomokuOpsConsole) return;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bridge=()=>window.GomokuCompetitionBridge||null;
  const fmt=value=>{if(!value)return '—';try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}catch{return String(value);}};
  const shortSha=value=>value?String(value).slice(0,8):'—';
  const roleCanRelease=role=>['release_manager','admin'].includes(String(role||''));
  const roleCanIncident=role=>['operator','incident_commander','admin'].includes(String(role||''));
  let state={authorized:false,overview:null,loading:false,error:'',probeAt:0,timer:0};

  async function get(path){
    const b=bridge();if(!b?.accountGet)throw Error('Operations bridge is unavailable.');
    return b.accountGet(path);
  }
  async function post(path,body){
    const b=bridge();if(!b?.accountPost)throw Error('Operations bridge is unavailable.');
    return b.accountPost(path,body||{});
  }
  function account(){return bridge()?.account?.()||{connected:false,username:null};}
  function notify(message){try{bridge()?.toast?.(message);}catch{}}

  function ensureButton(){
    const host=document.querySelector('#p8CompetitionPanel .p9-head-actions');
    if(!host||!state.authorized||$('p15OpsButton'))return;
    const b=document.createElement('button');
    b.id='p15OpsButton';b.className='btn ghost p15-ops-entry';b.type='button';b.textContent='Operations';
    b.onclick=open;host.prepend(b);
  }
  function removeButton(){$('p15OpsButton')?.remove();}

  async function probe(force=false){
    const a=account();
    if(!a.connected){state.authorized=false;state.overview=null;removeButton();schedule();return;}
    if(!force&&Date.now()-state.probeAt<30000){ensureButton();schedule();return;}
    state.probeAt=Date.now();
    try{
      const overview=await get('/api/admin/overview');
      state.authorized=!!overview?.operatorRole;state.overview=overview;state.error='';
    }catch(err){
      if(Number(err?.status)===403||Number(err?.status)===401){state.authorized=false;state.overview=null;state.error='';}
      else state.error=err?.message||'Operations status unavailable.';
    }
    if(state.authorized)ensureButton();else removeButton();
    schedule();
  }
  function schedule(){
    clearTimeout(state.timer);
    if(document.hidden)return;
    state.timer=setTimeout(()=>probe(false),30000);
  }

  function ensureDialog(){
    if($('p15OpsDialog'))return $('p15OpsDialog');
    const d=document.createElement('dialog');d.id='p15OpsDialog';d.className='p15-ops-dialog';d.setAttribute('aria-labelledby','p15OpsTitle');
    d.innerHTML='<div class="p15-ops-shell"><header><div><p class="eyebrow">P15 OPERATIONS</p><h2 id="p15OpsTitle">Competitive operations console</h2><p id="p15OpsSubtitle">Incident control · release validation · deployment reconciliation · drills</p></div><div class="p15-head-actions"><button class="btn ghost" id="p15OpsRefresh" type="button">Refresh</button><button class="p15-close" id="p15OpsClose" type="button" aria-label="Close">×</button></div></header><div id="p15OpsBody"></div></div>';
    document.body.append(d);
    $('p15OpsClose').onclick=()=>d.close();
    $('p15OpsRefresh').onclick=()=>refresh();
    return d;
  }

  function statusPill(value){
    const v=String(value||'unknown').toLowerCase();
    return '<span class="p15-pill" data-state="'+esc(v)+'">'+esc(v.replaceAll('_',' '))+'</span>';
  }
  function reconciliationMarkup(o){
    const r=o?.reconciliation||{},stateName=String(r.state||'untracked');
    return '<section class="p15-card p15-reconcile" data-state="'+esc(stateName)+'"><div><p class="eyebrow">DEPLOYMENT RECONCILIATION</p><h3>'+esc(stateName.replaceAll('_',' '))+'</h3><p>Expected '+esc(r.expectedVersion||'unregistered')+' · '+shortSha(r.expectedGitSha)+' / observed '+shortSha(r.observedGitSha)+(r.edgeFunctionVersion?' · Edge v'+Number(r.edgeFunctionVersion):'')+'</p></div><div class="p15-reconcile-meta"><span>Observed</span><b>'+esc(fmt(r.observedAt))+'</b></div></section>';
  }
  function operationsMarkup(o){
    const op=o?.operations||{},role=o?.operatorRole||'operator',incident=op.incident,rollout=op.rollout;
    return '<section class="p15-card"><div class="p15-section-head"><div><p class="eyebrow">CONTROL PLANE</p><h3>Production entry controls</h3></div>'+statusPill(op.serviceMode||'normal')+'</div>'+
      '<div class="p15-switch-grid">'+
        controlCheck('rankedEnabled','Ranked',op.rankedEnabled)+
        controlCheck('tournamentsEnabled','Tournaments',op.tournamentsEnabled)+
        controlCheck('challengesEnabled','Challenges',op.challengesEnabled)+
        controlCheck('roomCreationEnabled','Room creation',op.roomCreationEnabled)+
      '</div>'+
      '<div class="p15-form-grid"><label>Service mode<select id="p15ServiceMode"><option value="normal" '+(op.serviceMode==='normal'?'selected':'')+'>Normal</option><option value="degraded" '+(op.serviceMode==='degraded'?'selected':'')+'>Degraded</option><option value="maintenance" '+(op.serviceMode==='maintenance'?'selected':'')+'>Maintenance</option></select></label><label class="p15-wide">Public banner<input id="p15Banner" maxlength="160" value="'+esc(op.banner||'')+'" placeholder="Optional public-safe status message"></label><label class="p15-wide">Reason<input id="p15ControlReason" maxlength="800" placeholder="Required reason for this change"></label></div>'+
      (roleCanIncident(role)?'<div class="p15-actions"><button class="btn" id="p15SaveControls">Save controls</button></div>':'')+
      '<div class="p15-current-line"><span>Active incident</span><b>'+(incident?esc(incident.severity.toUpperCase()+' · '+incident.title):'None')+'</b><span>Rollout</span><b>'+(rollout?esc(rollout.status+' / '+rollout.stage):'None')+'</b></div></section>';
  }
  function controlCheck(id,label,on){return '<label class="p15-switch"><span>'+esc(label)+'</span><input id="p15'+id+'" type="checkbox" '+(on!==false?'checked':'')+'></label>';}

  function incidentsMarkup(o){
    const role=o?.operatorRole,items=Array.isArray(o?.incidents)?o.incidents:[],active=items.filter(x=>x.status!=='resolved');
    const rows=items.slice(0,8).map(x=>'<article class="p15-list-row"><div><b>'+esc(String(x.severity||'').toUpperCase())+' · '+esc(x.title)+'</b><span>'+statusPill(x.status)+' · '+fmt(x.started_at||x.startedAt)+'</span>'+(x.summary?'<p>'+esc(x.summary)+'</p>':'')+'</div>'+(roleCanIncident(role)&&x.status!=='resolved'?'<div class="p15-inline-actions"><button class="btn ghost" data-p15-incident="'+esc(x.id)+'" data-status="identified">Identified</button><button class="btn ghost" data-p15-incident="'+esc(x.id)+'" data-status="monitoring">Monitoring</button><button class="btn ghost" data-p15-incident="'+esc(x.id)+'" data-status="resolved">Resolve</button></div>':'')+'</article>').join('');
    return '<section class="p15-card"><div class="p15-section-head"><div><p class="eyebrow">INCIDENT RESPONSE</p><h3>'+active.length+' active incident'+(active.length===1?'':'s')+'</h3></div></div>'+
      (roleCanIncident(role)?'<div class="p15-form-grid"><label>Severity<select id="p15IncidentSeverity"><option>sev4</option><option>sev3</option><option>sev2</option><option>sev1</option></select></label><label class="p15-grow">Title<input id="p15IncidentTitle" maxlength="120" placeholder="Concise factual incident title"></label><label class="p15-wide">Summary<textarea id="p15IncidentSummary" maxlength="1200" rows="2" placeholder="What is affected?"></textarea></label><label class="p15-wide">Reason<input id="p15IncidentReason" maxlength="800" placeholder="Required reason"></label></div><div class="p15-actions"><button class="btn" id="p15OpenIncident">Open incident</button></div>':'')+
      '<div class="p15-subhead"><b>Recent incidents</b><label>Transition reason<input id="p15IncidentTransitionReason" maxlength="800" placeholder="Required before changing status"></label></div><div class="p15-list">'+(rows||'<div class="p15-empty">No incidents recorded.</div>')+'</div></section>';
  }

  function releasesMarkup(o){
    const role=o?.operatorRole,releases=Array.isArray(o?.releases)?o.releases:[],rollouts=Array.isArray(o?.rollouts)?o.rollouts:[],open=rollouts.find(x=>['planned','running','paused'].includes(x.status));
    const releaseRows=releases.slice(0,10).map(r=>'<article class="p15-list-row"><div><b>'+esc(r.version)+' · '+shortSha(r.git_sha||r.gitSha)+'</b><span>'+statusPill(r.status)+' · '+fmt(r.created_at||r.createdAt)+'</span></div>'+(roleCanRelease(role)?'<div class="p15-inline-actions">'+(r.status==='candidate'?'<button class="btn ghost" data-p15-release="'+esc(r.id)+'" data-release-action="approve">Approve</button>':'')+((r.status==='approved'||r.status==='active')&&!open?'<button class="btn ghost" data-p15-rollout-release="'+esc(r.id)+'">Start rollout record</button>':'')+'</div>':'')+'</article>').join('');
    return '<section class="p15-card"><div class="p15-section-head"><div><p class="eyebrow">RELEASE GOVERNANCE</p><h3>Registry & staged validation</h3></div><span class="p15-note">Stages are validation gates, not weighted traffic splitting.</span></div>'+
      (roleCanRelease(role)?'<div class="p15-form-grid"><label>Version<input id="p15ReleaseVersion" maxlength="48" placeholder="v1.2.3"></label><label class="p15-grow">Git SHA<input id="p15ReleaseGitSha" maxlength="40" placeholder="40-character commit SHA"></label><label>Source ref<input id="p15ReleaseSource" maxlength="160" placeholder="main / PR"></label><label class="p15-wide">Notes<input id="p15ReleaseNotes" maxlength="1200" placeholder="Release notes"></label><label class="p15-wide">Reason<input id="p15ReleaseReason" maxlength="800" placeholder="Required reason"></label></div><div class="p15-actions"><button class="btn" id="p15RegisterRelease">Register candidate</button></div>':'')+
      '<div class="p15-list">'+(releaseRows||'<div class="p15-empty">No governed releases yet.</div>')+'</div>'+rolloutMarkup(o)+'</section>';
  }

  function rolloutMarkup(o){
    const role=o?.operatorRole,rollouts=Array.isArray(o?.rollouts)?o.rollouts:[],releases=Array.isArray(o?.releases)?o.releases:[],r=rollouts.find(x=>['planned','running','paused'].includes(x.status));
    if(!r)return '<div class="p15-subsection"><div class="p15-subhead"><b>Active rollout</b><span>None</span></div></div>';
    const targetOptions=releases.filter(x=>x.id!==r.release_id&&['active','retired','approved','rolled_back'].includes(x.status)).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.version)+' · '+esc(x.status)+'</option>').join('');
    const actions=[];
    if(r.status==='planned')actions.push(['start','Start observe stage']);
    if(r.status==='running'&&r.stage!=='full')actions.push(['advance','Advance stage']);
    if(r.status==='running')actions.push(['pause','Pause']);
    if(r.status==='paused')actions.push(['resume','Resume']);
    if(r.status==='running'&&r.stage==='full')actions.push(['complete','Complete & activate']);
    if(['planned','running','paused'].includes(r.status))actions.push(['rollback','Rollback record']);
    return '<div class="p15-subsection"><div class="p15-section-head"><div><p class="eyebrow">OPEN ROLLOUT</p><h4>'+esc(r.release_version||'release')+' · '+esc(r.stage)+'</h4><span>'+statusPill(r.status)+' · stage since '+fmt(r.stage_started_at||r.created_at)+'</span></div></div>'+
      (roleCanRelease(role)?'<div class="p15-form-grid"><label class="p15-wide">Transition reason<input id="p15RolloutReason" maxlength="800" placeholder="Required reason"></label><label>Rollback target<select id="p15RollbackTarget"><option value="">Select if active release rollback is required</option>'+targetOptions+'</select></label></div><div class="p15-actions">'+actions.map(([a,l])=>'<button class="btn '+(a==='rollback'?'ghost p15-danger':'ghost')+'" data-p15-rollout="'+esc(r.id)+'" data-rollout-action="'+a+'">'+l+'</button>').join('')+'</div>':'')+
      '<p class="p15-note">Promotion requires healthy service state, a fresh matching deployment observation, and minimum dwell time: Observe 2 min → Limited 5 min → Broad 10 min → Full 15 min before completion.</p></div>';
  }

  function deploymentsMarkup(o){
    const role=o?.operatorRole,items=Array.isArray(o?.deployments)?o.deployments:[];
    const rows=items.slice(0,8).map(x=>'<article class="p15-list-row"><div><b>'+shortSha(x.git_sha)+' '+(x.release_version?'· '+esc(x.release_version):'· unregistered')+'</b><span>Edge '+(x.edge_function_version?'v'+Number(x.edge_function_version):'—')+' · '+esc(x.source||'unknown')+' · '+fmt(x.observed_at)+'</span></div></article>').join('');
    return '<section class="p15-card">'+reconciliationMarkup(o)+
      '<div class="p15-section-head"><div><p class="eyebrow">DEPLOYMENT OBSERVATIONS</p><h3>What is actually deployed?</h3></div></div>'+
      (roleCanRelease(role)?'<div class="p15-form-grid"><label class="p15-grow">Git SHA<input id="p15DeployGitSha" maxlength="40" placeholder="40-character production SHA"></label><label>Edge version<input id="p15DeployEdgeVersion" type="number" min="1" placeholder="41"></label><label class="p15-grow">Edge bundle SHA-256<input id="p15DeployEdgeSha" maxlength="64" placeholder="Optional 64-character hash"></label><label class="p15-grow">Frontend SHA<input id="p15DeployFrontendSha" maxlength="40" placeholder="Optional GitHub Pages SHA"></label><label class="p15-wide">Notes<input id="p15DeployNotes" maxlength="800" placeholder="Observed deployment details"></label><label class="p15-wide">Reason<input id="p15DeployReason" maxlength="800" placeholder="Required reason"></label></div><div class="p15-actions"><button class="btn" id="p15RecordDeployment">Record observation</button></div>':'')+
      '<div class="p15-list">'+(rows||'<div class="p15-empty">No deployment observations yet.</div>')+'</div></section>';
  }

  function drillsMarkup(o){
    const items=Array.isArray(o?.drills)?o.drills:[],rows=items.slice(0,8).map(d=>'<article class="p15-drill-row"><div><b>'+esc(String(d.scenario||'').replaceAll('_',' '))+'</b><span>'+statusPill(d.status)+' · '+esc(d.mode||'')+' · '+fmt(d.created_at)+'</span></div><div class="p15-checks">'+Object.entries(d.checks||{}).map(([k,v])=>'<span data-pass="'+(v===true)+'">'+(v===true?'✓':'×')+' '+esc(k.replace(/([A-Z])/g,' $1'))+'</span>').join('')+'</div></article>').join('');
    return '<section class="p15-card"><div class="p15-section-head"><div><p class="eyebrow">INCIDENT DRILLS</p><h3>Non-destructive certification</h3></div></div><p class="p15-note">Drills inspect real production contracts and privilege boundaries without disabling live services, ending rooms, or changing release state.</p><div class="p15-actions"><select id="p15DrillScenario"><option value="full">Full certification</option><option value="ranked_outage">Ranked outage</option><option value="persistence_degradation">Persistence degradation</option><option value="bad_release">Bad release / rollback</option></select><button class="btn" id="p15RunDrill">Run drill</button></div><div class="p15-list">'+(rows||'<div class="p15-empty">No drills recorded yet.</div>')+'</div></section>';
  }

  function auditMarkup(o){
    const items=Array.isArray(o?.audit)?o.audit:[];
    return '<section class="p15-card"><div class="p15-section-head"><div><p class="eyebrow">AUDIT EVIDENCE</p><h3>Recent administrative changes</h3></div></div><div class="p15-audit">'+items.slice(0,20).map(x=>'<div><time>'+fmt(x.created_at)+'</time><b>'+esc(x.action)+'</b><span>'+esc(x.actor_role||'')+(x.reason?' · '+esc(x.reason):'')+'</span><code>'+esc(x.request_id||'—')+'</code></div>').join('')+'</div></section>';
  }

  function render(){
    const body=$('p15OpsBody');if(!body)return;
    if(state.loading){body.innerHTML='<div class="p15-loading">Loading production operations…</div>';return;}
    if(state.error){body.innerHTML='<p class="p15-error">'+esc(state.error)+'</p>';return;}
    const o=state.overview;if(!o){body.innerHTML='<p class="p15-error">Administrative access is unavailable.</p>';return;}
    body.innerHTML='<div class="p15-role-line"><span>Authorized as</span><b>'+esc(o.operatorRole)+'</b><span>Generated '+fmt(o.generatedAt)+'</span></div>'+
      operationsMarkup(o)+incidentsMarkup(o)+releasesMarkup(o)+deploymentsMarkup(o)+drillsMarkup(o)+auditMarkup(o);
    bind();
  }

  async function refresh(){
    if(state.loading)return;state.loading=true;state.error='';render();
    try{state.overview=await get('/api/admin/overview');state.authorized=true;}
    catch(err){state.error=err?.message||'Could not load operations console.';if([401,403].includes(Number(err?.status)))state.authorized=false;}
    finally{state.loading=false;render();ensureButton();}
  }

  async function mutate(action,button){
    if(button)button.disabled=true;
    try{await action();await refresh();}
    catch(err){notify(err?.message||'Administrative action failed.');}
    finally{if(button)button.disabled=false;}
  }
  function value(id){return $(id)?.value?.trim()||'';}
  function bind(){
    if($('p15SaveControls'))$('p15SaveControls').onclick=e=>mutate(async()=>{
      await post('/api/admin/controls',{
        serviceMode:value('p15ServiceMode'),
        rankedEnabled:$('p15rankedEnabled')?.checked!==false,
        tournamentsEnabled:$('p15tournamentsEnabled')?.checked!==false,
        challengesEnabled:$('p15challengesEnabled')?.checked!==false,
        roomCreationEnabled:$('p15roomCreationEnabled')?.checked!==false,
        banner:value('p15Banner'),
        reason:value('p15ControlReason')
      });notify('Competitive controls updated.');
    },e.currentTarget);

    if($('p15OpenIncident'))$('p15OpenIncident').onclick=e=>mutate(async()=>{
      await post('/api/admin/incidents',{severity:value('p15IncidentSeverity'),title:value('p15IncidentTitle'),summary:value('p15IncidentSummary'),reason:value('p15IncidentReason')});notify('Incident opened.');
    },e.currentTarget);

    document.querySelectorAll('[data-p15-incident]').forEach(b=>b.onclick=e=>mutate(async()=>{
      await post('/api/admin/incidents/'+encodeURIComponent(b.dataset.p15Incident),{status:b.dataset.status,reason:value('p15IncidentTransitionReason')});notify('Incident updated.');
    },e.currentTarget));

    if($('p15RegisterRelease'))$('p15RegisterRelease').onclick=e=>mutate(async()=>{
      await post('/api/admin/releases',{version:value('p15ReleaseVersion'),gitSha:value('p15ReleaseGitSha'),sourceRef:value('p15ReleaseSource'),notes:value('p15ReleaseNotes'),reason:value('p15ReleaseReason')});notify('Release candidate registered.');
    },e.currentTarget);

    document.querySelectorAll('[data-p15-release]').forEach(b=>b.onclick=e=>mutate(async()=>{
      await post('/api/admin/releases/'+encodeURIComponent(b.dataset.p15Release)+'/transition',{action:b.dataset.releaseAction,reason:'Approved through P15 operations console'});notify('Release approved.');
    },e.currentTarget));

    document.querySelectorAll('[data-p15-rollout-release]').forEach(b=>b.onclick=e=>mutate(async()=>{
      const reason=value('p15ReleaseReason')||'Started staged validation through P15 operations console';
      await post('/api/admin/rollouts',{releaseId:b.dataset.p15RolloutRelease,reason});notify('Rollout record created.');
    },e.currentTarget));

    document.querySelectorAll('[data-p15-rollout]').forEach(b=>b.onclick=e=>mutate(async()=>{
      await post('/api/admin/rollouts/'+encodeURIComponent(b.dataset.p15Rollout)+'/transition',{action:b.dataset.rolloutAction,targetReleaseId:value('p15RollbackTarget')||null,reason:value('p15RolloutReason')});notify('Rollout updated.');
    },e.currentTarget));

    if($('p15RecordDeployment'))$('p15RecordDeployment').onclick=e=>mutate(async()=>{
      await post('/api/admin/deployments',{
        gitSha:value('p15DeployGitSha'),
        edgeFunctionVersion:value('p15DeployEdgeVersion')?Number(value('p15DeployEdgeVersion')):null,
        edgeBundleSha256:value('p15DeployEdgeSha')||null,
        frontendSha:value('p15DeployFrontendSha')||null,
        notes:value('p15DeployNotes'),reason:value('p15DeployReason')
      });notify('Deployment observation recorded.');
    },e.currentTarget);

    if($('p15RunDrill'))$('p15RunDrill').onclick=e=>mutate(async()=>{
      const result=await post('/api/admin/drills',{scenario:value('p15DrillScenario')||'full'});
      notify(result?.drill?.status==='passed'?'Incident drill passed.':'Incident drill found a failed check.');
    },e.currentTarget);
  }

  async function open(){
    const d=ensureDialog();if(!d.open)d.showModal();await refresh();
  }

  const observer=new MutationObserver(()=>ensureButton());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)probe(true);else clearTimeout(state.timer);});
  window.addEventListener('beforeunload',()=>clearTimeout(state.timer));
  const boot=()=>{if(!bridge())return setTimeout(boot,250);probe(true);};boot();

  window.GomokuOpsConsole=Object.freeze({version:'1.0.0',open,refresh,probe:()=>probe(true)});
})();
