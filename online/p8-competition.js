/* P9 — Competitive Operations, Spectating & Event Polish. */
(() => {
  'use strict';
  if (window.GomokuCompetition) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = value => { try { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)); } catch { return String(value||''); } };
  const fmtTime = value => { try { return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(value)); } catch { return ''; } };
  const bridge = () => window.GomokuCompetitionBridge || null;
  const notifyKey='gomoku.p9.competition.notified.v1';
  let model={season:null,seasonPlayers:[],seasons:[],tournaments:[],detail:null,me:null,community:null,trust:null,discover:[],communityQuery:'',scope:'live',loading:false,error:''},mounted=false,refreshTimer=0,roomTimer=0;

  async function publicGet(path){const b=bridge();if(!b)throw Error('Competition services are still loading.');return b.publicGet(path);}
  async function accountPost(path,body={}){const b=bridge();if(!b)throw Error('Competition services are still loading.');return b.accountPost(path,body);}
  function account(){return bridge()?.account?.()||{connected:false,username:null};}
  function notify(message){try{bridge()?.toast?.(message);}catch{}}
  function notifiedSet(){try{return new Set(JSON.parse(sessionStorage.getItem(notifyKey)||'[]'));}catch{return new Set();}}
  function saveNotified(set){try{sessionStorage.setItem(notifyKey,JSON.stringify([...set].slice(-40)));}catch{}}
  function deadlineLabel(m){
    if(m.startedAt)return 'In progress';
    if(m.status==='completed')return m.forfeit?'Forfeit':'Completed';
    if(m.status==='cancelled')return 'Cancelled';
    if(m.player1CheckedIn&&m.player2CheckedIn)return 'Both players checked in';
    if(m.deadlineMissed)return m.needsOrganizerAction?'No-show · organizer action needed':'Check-in deadline passed';
    if(m.readyDeadline)return 'Check in by '+fmtTime(m.readyDeadline);
    return m.status==='active'?'Match ready':'Waiting';
  }
  function eventLabel(type){
    return ({created:'Tournament created',joined:'Player joined',left:'Player left',started:'Bracket started',room_ready:'Match room ready',check_in:'Player checked in',match_started:'Match started',match_completed:'Match completed',replay:'Draw · replay queued',next_match_ready:'Next match ready',forfeit:'Forfeit',champion:'Champion crowned',renamed:'Tournament renamed',removed:'Player removed',cancelled:'Tournament cancelled',deadline_extended:'Deadline extended',deadline_missed:'Check-in missed',organizer_ruling:'Organizer ruling'})[type]||String(type||'Event').replaceAll('_',' ');
  }

  function ensureDialog(){
    if($('p8CompetitionDialog'))return $('p8CompetitionDialog');
    const d=document.createElement('dialog');d.id='p8CompetitionDialog';d.className='p8-competition-dialog';d.setAttribute('aria-labelledby','p8CompetitionTitle');
    d.innerHTML='<div class="p8-competition-shell"><header><div><p class="eyebrow" id="p8CompetitionKicker">COMPETITION</p><h2 id="p8CompetitionTitle">Tournament</h2><p id="p8CompetitionSubtitle"></p></div><button class="p8-close" id="p8CompetitionClose" aria-label="Close">×</button></header><div id="p8CompetitionDetail"></div></div>';
    document.body.append(d);$('p8CompetitionClose').onclick=()=>d.close();return d;
  }
  function seasonMarkup(){
    const s=model.season,players=model.seasonPlayers||[];
    if(!s)return '<div class="p8-empty">No ranked season is active.</div>';
    const top=players.slice(0,5).map(p=>'<div class="p8-standing"><b>#'+p.rank+'</b><span>@'+esc(p.username)+'</span><strong>'+p.points+' pts</strong><small>'+p.rating+' rating</small></div>').join('');
    const mine=model.me?.standing;
    return '<div class="p8-season-card"><div class="p9-season-copy"><p class="eyebrow">CURRENT SEASON</p><h4>'+esc(s.name)+'</h4><span>'+fmtDate(s.startsAt)+' – '+fmtDate(s.endsAt)+'</span>'+(mine?'<div class="p9-my-season"><b>#'+mine.rank+'</b><span>'+mine.points+' pts · '+mine.rating+' rating</span></div>':'')+'<div class="p9-season-actions"><button class="btn ghost" data-p9-season="'+esc(s.code)+'">Full standings</button><button class="btn ghost" id="p9SeasonHistory">Season history</button></div></div><div class="p8-season-board">'+(top||'<p class="tiny">No ranked games recorded this season yet.</p>')+'</div></div>';
  }
  function careerMarkup(){
    const c=model.me?.career,a=account();
    if(!a.connected||!a.username)return '';
    if(!c)return '<section class="p10-career-card"><div><p class="eyebrow">COMPETITIVE IDENTITY</p><h4>@'+esc(a.username)+'</h4><span>Your verified career appears after your first competitive result.</span></div><button class="btn ghost" id="p10Career">Open profile</button></section>';
    const seasonBest=c.bestSeasonRank?'#'+c.bestSeasonRank:'—';
    return '<section class="p10-career-card"><div class="p10-career-copy"><p class="eyebrow">COMPETITIVE IDENTITY</p><h4>@'+esc(a.username)+'</h4><span>Real accomplishments only · no XP or artificial levels</span></div><div class="p10-career-mini"><div><b>'+c.currentRating+'</b><span>rating</span></div><div><b>'+c.peakRating+'</b><span>peak</span></div><div><b>'+c.bestRankedWinStreak+'</b><span>best streak</span></div><div><b>'+c.tournamentTitles+'</b><span>cup titles</span></div><div><b>'+seasonBest+'</b><span>best season</span></div><div><b>'+Number(model.me?.achievementCount||0)+'</b><span>badges</span></div></div><button class="btn ghost" id="p10Career">Career & trophies</button></section>';
  }
  function achievementBadge(a,{selectable=false,selected=false}={}){
    if(!a)return '';
    const cls='p10-badge tier-'+esc(a.tier)+(selected?' is-selected':'')+(a.earned===false?' is-locked':'');
    const attrs=selectable&&a.earned!==false?' data-p10-pick="'+esc(a.code)+'" aria-pressed="'+selected+'"':'';
    const progress=a.earned===false?'<span class="p10-progress"><i style="width:'+Math.max(0,Math.min(100,Math.round((Number(a.value)||0)*100/Math.max(1,Number(a.target)||1))))+'%"></i></span><small>'+Math.min(Number(a.value)||0,Number(a.target)||1)+' / '+(Number(a.target)||1)+'</small>':a.earnedAt?'<small>Earned '+fmtDate(a.earnedAt)+'</small>':'';
    const tag=selectable&&a.earned!==false?'button':'div';
    return '<'+tag+' class="'+cls+'"'+attrs+'><span class="p10-badge-mark" aria-hidden="true"></span><div><b>'+esc(a.title)+'</b><span>'+esc(a.description)+'</span>'+progress+'</div></'+tag+'>';
  }
  function trophyMarkup(t){
    const icon=t.type==='tournament_title'?'Cup':t.type==='season_title'?'#1':'#'+(t.rank||'');
    return '<div class="p10-trophy"><b>'+esc(icon)+'</b><div><strong>'+esc(t.label||'Trophy')+'</strong><span>'+esc(t.name||'')+'</span><small>'+fmtDate(t.earnedAt)+'</small></div></div>';
  }
  function careerProfileMarkup(username,data,own=false){
    const c=data?.career||{},showcase=data?.showcase||[],earned=data?.achievements||[],trophies=data?.trophies||[],seasons=data?.seasons||[],tournaments=data?.tournaments||[],progress=data?.progress||[];
    const record=(c.rankedWins||0)+'-'+(c.rankedDraws||0)+'-'+(c.rankedLosses||0);
    const showcaseCodes=new Set(showcase.map(x=>x.code));
    const badgeRows=own&&progress.length?progress:earned;
    return '<div class="p10-profile">'+
      '<section class="p10-profile-hero"><div><p class="eyebrow">COMPETITIVE PROFILE</p><h3>@'+esc(username)+'</h3><p>Verified Renju results, tournament finishes, seasonal placements, and earned milestones.</p></div><div class="p10-showcase">'+(showcase.length?showcase.map(a=>achievementBadge(a)).join(''):'<div class="p8-empty">No featured achievements yet.</div>')+'</div></section>'+
      '<section class="p10-record-grid"><div><b>'+Number(c.currentRating||1500)+'</b><span>Current rating</span></div><div><b>'+Number(c.peakRating||1500)+'</b><span>Peak rating</span></div><div><b>'+esc(record)+'</b><span>Ranked W-D-L</span></div><div><b>'+Number(c.bestRankedWinStreak||0)+'</b><span>Best ranked streak</span></div><div><b>'+Number(c.tournamentTitles||0)+'</b><span>Tournament titles</span></div><div><b>'+(c.bestSeasonRank?'#'+c.bestSeasonRank:'—')+'</b><span>Best season rank</span></div><div><b>'+Number(c.seasonPodiums||0)+'</b><span>Season podiums</span></div><div><b>'+Number(c.seasonsPlayed||0)+'</b><span>Seasons played</span></div></section>'+
      '<section class="p10-section"><div class="p10-section-head"><div><p class="eyebrow">TROPHY CABINET</p><h4>Competitive finishes</h4></div><span>'+trophies.length+' trophies</span></div><div class="p10-trophy-grid">'+(trophies.length?trophies.map(trophyMarkup).join(''):'<div class="p8-empty">Tournament titles and season podiums appear here.</div>')+'</div></section>'+
      '<section class="p10-section"><div class="p10-section-head"><div><p class="eyebrow">ACHIEVEMENTS</p><h4>'+(own?'Milestones & showcase':'Earned milestones')+'</h4></div><span>'+earned.length+' earned</span></div>'+(own?'<p class="p10-help">Choose up to three earned badges to feature on your public profile. Locked badges show factual progress toward the next milestone.</p>':'')+'<div class="p10-achievement-grid">'+(badgeRows.length?badgeRows.map(a=>achievementBadge(a,{selectable:own,selected:showcaseCodes.has(a.code)})).join(''):'<div class="p8-empty">No competitive achievements earned yet.</div>')+'</div>'+(own?'<div class="p10-save-row"><span id="p10ShowcaseCount">'+showcaseCodes.size+' / 3 selected</span><button class="btn" id="p10SaveShowcase">Save showcase</button></div>':'')+'</section>'+
      '<section class="p10-section"><div class="p10-section-head"><div><p class="eyebrow">SEASONS</p><h4>Placement history</h4></div></div><div class="p10-history">'+(seasons.length?seasons.map(x=>'<div><span><b>'+esc(x.name)+'</b><small>'+esc(x.status)+'</small></span><strong>#'+x.rank+'</strong><em>'+x.points+' pts · '+x.wins+'-'+x.draws+'-'+x.losses+'</em></div>').join(''):'<div class="p8-empty">No seasonal ranked record yet.</div>')+'</div></section>'+
      '<section class="p10-section"><div class="p10-section-head"><div><p class="eyebrow">TOURNAMENTS</p><h4>Event history</h4></div></div><div class="p10-history">'+(tournaments.length?tournaments.map(x=>'<div><span><b>'+esc(x.name)+'</b><small>'+esc(x.status)+(x.seed?' · seed #'+x.seed:'')+'</small></span><strong>'+(x.champion?'Champion':x.eliminatedAt?'Finished':'Active')+'</strong><em>'+fmtDate(x.completedAt||x.joinedAt)+'</em></div>').join(''):'<div class="p8-empty">No tournament record yet.</div>')+'</div></section>'+
    '</div>';
  }
  async function openCareerProfile(username=account().username){
    const clean=String(username||'').trim();if(!clean)return;
    const own=account().connected&&account().username&&clean.toLowerCase()===String(account().username).toLowerCase(),d=ensureDialog(),body=$('p8CompetitionDetail');
    if(!d.open)d.showModal();$('p8CompetitionKicker').textContent='PLAYER';$('p8CompetitionTitle').textContent='@'+clean;$('p8CompetitionSubtitle').textContent='Competitive identity, rivalry & career';body.innerHTML='<div class="p8-loading">Loading competitive career…</div>';
    try{
      let data,profile=null,h2h=null;
      if(own){const res=await accountPost('/api/competition/career',{});data=res.competitive;}
      else{const res=await publicGet('/api/profiles/'+encodeURIComponent(clean));profile=res.profile||null;data=profile?.competitive;if(account().connected){try{h2h=await accountPost('/api/community/head-to-head/'+encodeURIComponent(clean),{});}catch{}}}
      if(!data)throw Error('Competitive profile is unavailable.');
      body.innerHTML=profileSocialMarkup(clean,profile,h2h)+careerProfileMarkup(clean,data,own);
      if(own)wireShowcase(clean,data);else wireProfileSocial(clean);
    }catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load competitive profile.')+'</p>';}
  }
  function wireShowcase(username,data){
    const body=$('p8CompetitionDetail');if(!body)return;
    const selected=new Set((data?.showcase||[]).map(x=>x.code));
    const update=()=>{body.querySelectorAll('[data-p10-pick]').forEach(b=>{const on=selected.has(b.dataset.p10Pick);b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});const count=$('p10ShowcaseCount');if(count)count.textContent=selected.size+' / 3 selected';};
    body.querySelectorAll('[data-p10-pick]').forEach(b=>b.onclick=()=>{const code=b.dataset.p10Pick;if(selected.has(code))selected.delete(code);else if(selected.size<3)selected.add(code);else{notify('Choose at most three showcase achievements.');return;}update();});
    const save=$('p10SaveShowcase');if(save)save.onclick=async()=>{save.disabled=true;try{const res=await accountPost('/api/competition/showcase',{codes:[...selected]});notify('Competitive showcase updated.');body.innerHTML=careerProfileMarkup(username,res.competitive,true);wireShowcase(username,res.competitive);await refresh(true);}catch(err){notify(err?.message||'Could not save showcase.');}finally{save.disabled=false;}};
    update();
  }

  function presenceLabel(status){return status==='in_game'?'In game':status==='online'?'Online':'Offline';}
  function favoriteNames(){return new Set((model.community?.favorites||[]).map(x=>String(x.username||'').toLowerCase()));}
  function socialPlayerCard(p,{recent=false}={}){
    const favorite=favoriteNames().has(String(p.username||'').toLowerCase())||p.favorite===true,h=p.headToHead||null;
    const actions=account().connected?'<div class="p11-player-actions"><button class="btn ghost" data-p11-favorite="'+esc(p.username)+'" data-on="'+favorite+'" aria-label="'+(favorite?'Remove favorite':'Add favorite')+'">'+(favorite?'★':'☆')+'</button><button class="btn ghost" data-p11-challenge="'+esc(p.username)+'" '+(p.canChallenge===false?'disabled':'')+'>Challenge</button></div>':'';
    return '<div class="p11-player-card"><button class="p11-player-main" data-p11-profile="'+esc(p.username)+'"><span class="p11-presence '+esc(p.presence||'offline')+'"></span><span><b>@'+esc(p.username)+'</b><small>'+esc(p.tier||'Unrated')+' · '+Number(p.rating||1500)+' rating · '+esc(presenceLabel(p.presence))+'</small></span></button>'+
      (recent&&h?'<div class="p11-h2h"><b>'+Number(h.wins||0)+'-'+Number(h.draws||0)+'-'+Number(h.losses||0)+'</b><span>head-to-head · '+Number(h.games||0)+' games</span></div>':'')+actions+'</div>';
  }
  function communitySummaryMarkup(){
    const a=account(),discover=model.discover||[];
    if(!a.connected||!a.username){
      return '<section class="p11-community-card"><div><p class="eyebrow">COMMUNITY</p><h4>Players & rivalries</h4><span>Discover verified players. Connect THIEPN Account for favorites, challenges and head-to-head records.</span></div><div class="p11-community-preview">'+discover.slice(0,4).map(x=>'<button data-p11-profile="'+esc(x.username)+'"><span class="p11-presence '+esc(x.presence||'offline')+'"></span>@'+esc(x.username)+' <small>'+Number(x.rating||1500)+'</small></button>').join('')+'</div><button class="btn ghost" id="p11Community">Discover players</button></section>';
    }
    const c=model.community||{},incoming=(c.challenges||[]).filter(x=>x.direction==='incoming'&&x.status==='pending').length,recent=(c.recentOpponents||[]).slice(0,3),favorites=(c.favorites||[]).slice(0,3);
    return '<section class="p11-community-card"><div class="p11-community-copy"><p class="eyebrow">COMMUNITY</p><h4>Players & rivalries</h4><span>'+(incoming?incoming+' incoming challenge'+(incoming===1?'':'s'):'Recent opponents, favorites and direct Renju challenges')+'</span></div><div class="p11-community-stats"><div><b>'+Number((c.recentOpponents||[]).length)+'</b><span>recent rivals</span></div><div><b>'+Number((c.favorites||[]).length)+'</b><span>favorites</span></div><div><b>'+incoming+'</b><span>incoming</span></div></div><div class="p11-community-preview">'+[...recent,...favorites].slice(0,4).map(x=>'<button data-p11-profile="'+esc(x.username)+'"><span class="p11-presence '+esc(x.presence||'offline')+'"></span>@'+esc(x.username)+' <small>'+Number(x.rating||1500)+'</small></button>').join('')+'</div><button class="btn ghost" id="p11Community">Open community</button></section>';
  }
  function challengeMarkup(ch){
    const pending=ch.status==='pending',incoming=ch.direction==='incoming',accepted=ch.status==='accepted';
    let actions='';
    if(pending&&incoming)actions='<button class="btn" data-p11-ch-action="accept" data-id="'+esc(ch.id)+'">Accept</button><button class="btn ghost" data-p11-ch-action="decline" data-id="'+esc(ch.id)+'">Decline</button>';
    else if(pending)actions='<button class="btn ghost" data-p11-ch-action="cancel" data-id="'+esc(ch.id)+'">Cancel</button>';
    else if(accepted&&ch.roomId)actions='<button class="btn" data-p11-ch-open="'+esc(ch.id)+'">Open match</button>';
    return '<div class="p11-challenge" data-state="'+esc(ch.status)+'"><div><span class="p11-direction">'+(incoming?'Incoming from':'Sent to')+'</span><b>@'+esc(ch.other)+'</b><small>'+esc(ch.status)+(ch.expiresAt&&pending?' · expires '+fmtTime(ch.expiresAt):'')+'</small></div><div>'+actions+'</div></div>';
  }

  function activeUntil(value){return value&&new Date(value).getTime()>Date.now()?value:null;}
  function trustSummaryMarkup(){
    const t=model.trust;if(!account().connected||!t)return '';
    const st=t.state||{},ranked=activeUntil(st.rankedSuspendedUntil)||activeUntil(st.rankedCooldownUntil),challenges=activeUntil(st.challengesSuspendedUntil),blocked=(t.blocked||[]).length,reports=(t.reports||[]).length;
    return '<section class="p12-trust-card '+(ranked||challenges?'has-restriction':'')+'"><div><p class="eyebrow">FAIR PLAY</p><h4>Competitive trust & safety</h4><span>'+(ranked?'Ranked access restricted until '+fmtDate(ranked)+' '+fmtTime(ranked):challenges?'Direct challenges restricted until '+fmtDate(challenges)+' '+fmtTime(challenges):'Blocks, reports, disconnect policy and rating safeguards')+'</span></div><div class="p12-trust-counts"><span><b>'+blocked+'</b> blocked</span><span><b>'+reports+'</b> reports</span></div><button class="btn ghost" id="p12TrustCenter">Fair Play center</button></section>';
  }
  function reportLabel(category){return({cheating:'Cheating / external assistance',stalling_disconnect:'Stalling / disconnect abuse',harassment:'Harassment',rating_manipulation:'Rating manipulation / collusion',inappropriate_username:'Inappropriate username',other:'Other'})[category]||category;}
  function trustCenterMarkup(){
    const t=model.trust||{},st=t.state||{},blocked=t.blocked||[],reports=t.reports||[],p=t.policy||{},rankedCooldown=activeUntil(st.rankedCooldownUntil),rankedSuspended=activeUntil(st.rankedSuspendedUntil),challengeSuspended=activeUntil(st.challengesSuspendedUntil);
    const restriction=(rankedCooldown||rankedSuspended||challengeSuspended)?'<div class="p12-restrictions">'+(rankedCooldown?'<div><b>Ranked cooldown</b><span>Until '+fmtDate(rankedCooldown)+' '+fmtTime(rankedCooldown)+'</span></div>':'')+(rankedSuspended?'<div><b>Ranked restriction</b><span>Until '+fmtDate(rankedSuspended)+' '+fmtTime(rankedSuspended)+'</span></div>':'')+(challengeSuspended?'<div><b>Challenge restriction</b><span>Until '+fmtDate(challengeSuspended)+' '+fmtTime(challengeSuspended)+'</span></div>':'')+'</div>':'<div class="p12-clear"><b>No active restrictions</b><span>Your competitive access is currently clear.</span></div>';
    return '<div class="p12-trust-center"><section class="p12-policy-hero"><div><p class="eyebrow">YOUR STATUS</p><h3>Fair Play center</h3><p>Objective protections are automatic. Player reports are review inputs only and never automatically punish another player.</p></div>'+restriction+'</section>'+
      '<section class="p12-section"><div class="p12-section-head"><div><p class="eyebrow">POLICY</p><h4>Transparent competitive safeguards</h4></div></div><div class="p12-policy-grid"><div><b>'+Number(p.competitiveDisconnectGraceSeconds||120)+'s</b><span>competitive disconnect grace</span></div><div><b>'+(p.rankedAbandonCooldownsMinutes||[15,30,60]).join(' / ')+' min</b><span>3rd / 4th / later ranked abandon cooldown</span></div><div><b>Game '+Number(p.repeatPairRatingProtection?.reducedFromGame||4)+'</b><span>same-pair Elo impact starts reducing</span></div><div><b>Game '+Number(p.repeatPairRatingProtection?.minimalFromGame||6)+'</b><span>same-pair Elo impact becomes minimal</span></div></div><p class="p12-policy-note">Matchmaking avoids immediate repeat opponents when possible. Integrity flags are review signals, not guilt determinations.</p></section>'+
      '<section class="p12-section"><div class="p12-section-head"><div><p class="eyebrow">BLOCKED PLAYERS</p><h4>Private interaction blocks</h4></div><span>'+blocked.length+'</span></div><div class="p12-block-list">'+(blocked.length?blocked.map(x=>'<div><button data-p12-profile="'+esc(x.username)+'">@'+esc(x.username)+'</button><span>Blocked '+fmtDate(x.createdAt)+'</span><button class="btn ghost" data-p12-unblock="'+esc(x.username)+'">Unblock</button></div>').join(''):'<div class="p8-empty">You have not blocked any players.</div>')+'</div></section>'+
      '<section class="p12-section"><div class="p12-section-head"><div><p class="eyebrow">YOUR REPORTS</p><h4>Review status</h4></div><span>'+reports.length+' recent</span></div><div class="p12-report-list">'+(reports.length?reports.map(r=>'<div><span><b>@'+esc(r.targetUsername)+'</b><small>'+esc(reportLabel(r.category))+' · '+fmtDate(r.createdAt)+'</small></span><em data-state="'+esc(r.status)+'">'+esc(r.status)+'</em>'+(r.resolution?'<p>'+esc(r.resolution)+'</p>':'')+'</div>').join(''):'<div class="p8-empty">No reports submitted.</div>')+'</div></section></div>';
  }
  async function loadTrust(){
    if(!account().connected){model.trust=null;return null;}
    const data=await accountPost('/api/trust/me',{});model.trust=data||null;return model.trust;
  }
  async function openTrustCenter(){
    if(!account().connected){notify('Connect THIEPN Account to use Fair Play controls.');return;}
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(!d.open)d.showModal();
    $('p8CompetitionKicker').textContent='FAIR PLAY';$('p8CompetitionTitle').textContent='Trust & safety';$('p8CompetitionSubtitle').textContent='Transparent safeguards · private controls · reviewable reports';
    body.innerHTML='<div class="p8-loading">Loading Fair Play status…</div>';
    try{await loadTrust();body.innerHTML=trustCenterMarkup();wireTrustCenter();}catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load Fair Play status.')+'</p>';}
  }
  function wireTrustCenter(){
    const body=$('p8CompetitionDetail');if(!body)return;
    body.querySelectorAll('[data-p12-profile]').forEach(b=>b.onclick=()=>openCareerProfile(b.dataset.p12Profile));
    body.querySelectorAll('[data-p12-unblock]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await toggleBlock(b.dataset.p12Unblock,false);await openTrustCenter();}finally{b.disabled=false;}});
  }
  async function toggleBlock(username,blocked){
    const data=await accountPost('/api/trust/block',{username,blocked});notify(blocked?'@'+username+' blocked. Future challenges and ranked pairings are prevented.':'@'+username+' unblocked.');await Promise.all([loadTrust(),loadCommunity(model.communityQuery)]);render();return data;
  }
  async function openReportPlayer(username,context={}){
    if(!account().connected){notify('Connect THIEPN Account to submit a report.');return;}
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(!d.open)d.showModal();
    $('p8CompetitionKicker').textContent='FAIR PLAY REPORT';$('p8CompetitionTitle').textContent='Report @'+username;$('p8CompetitionSubtitle').textContent='Reports are reviewed; submission does not automatically penalize a player.';
    body.innerHTML='<div class="p12-report-form"><label>Reason<select id="p12ReportCategory"><option value="cheating">Cheating / external assistance</option><option value="stalling_disconnect">Stalling / disconnect abuse</option><option value="harassment">Harassment</option><option value="rating_manipulation">Rating manipulation / collusion</option><option value="inappropriate_username">Inappropriate username</option><option value="other">Other</option></select></label><label>Details <small>Optional · factual context helps review.</small><textarea id="p12ReportDetails" maxlength="800" rows="5" placeholder="What happened?"></textarea></label>'+(context.roomId?'<p class="p12-match-ref">Match context: '+esc(context.roomId)+' · game '+Number(context.gameVersion||1)+'</p>':'')+'<div class="p12-report-actions"><button class="btn ghost" id="p12ReportCancel">Cancel</button><button class="btn" id="p12ReportSubmit">Submit report</button></div></div>';
    $('p12ReportCancel').onclick=()=>d.close();$('p12ReportSubmit').onclick=async()=>{const button=$('p12ReportSubmit');button.disabled=true;try{await accountPost('/api/trust/report',{username,category:$('p12ReportCategory').value,details:$('p12ReportDetails').value,...context});notify('Report submitted for review.');await loadTrust();d.close();render();}catch(err){notify(err?.message||'Could not submit report.');button.disabled=false;}};
  }
  function communityDialogMarkup(){
    const a=account(),c=model.community||{},discover=model.discover||[],recent=c.recentOpponents||[],favorites=c.favorites||[],challenges=c.challenges||[],prefs=c.preferences||{allowChallenges:true,showPresence:true};
    return '<div class="p11-community"><section class="p11-community-toolbar"><div><p class="eyebrow">PLAYER DISCOVERY</p><h3>Find people to play</h3><p>Verified profiles, actual head-to-head records, private favorites, and opt-in direct challenges.</p></div><div class="p11-search"><input id="p11Search" maxlength="20" value="'+esc(model.communityQuery||'')+'" placeholder="Search username" aria-label="Search players"><button class="btn" id="p11SearchBtn">Search</button></div></section>'+
      (a.connected&&a.username?'<section class="p11-section"><div class="p11-section-head"><div><p class="eyebrow">CHALLENGES</p><h4>Invitations</h4></div><span>'+challenges.length+' active</span></div><div class="p11-challenge-list">'+(challenges.length?challenges.map(challengeMarkup).join(''):'<div class="p8-empty">No pending or active direct challenges.</div>')+'</div></section>':'')+
      (a.connected&&a.username?'<section class="p11-section"><div class="p11-section-head"><div><p class="eyebrow">RIVALRIES</p><h4>Recent opponents</h4></div><span>Based only on recorded games</span></div><div class="p11-player-grid">'+(recent.length?recent.map(x=>socialPlayerCard(x,{recent:true})).join(''):'<div class="p8-empty">Play verified opponents to build head-to-head history.</div>')+'</div></section>':'')+
      (a.connected&&a.username?'<section class="p11-section"><div class="p11-section-head"><div><p class="eyebrow">FAVORITES</p><h4>Players you saved</h4></div><span>Private to you</span></div><div class="p11-player-grid">'+(favorites.length?favorites.map(x=>socialPlayerCard(x)).join(''):'<div class="p8-empty">Favorite players to keep them easy to find.</div>')+'</div></section>':'')+
      '<section class="p11-section"><div class="p11-section-head"><div><p class="eyebrow">DISCOVER</p><h4>'+(model.communityQuery?'Search results':'Verified players')+'</h4></div><span>'+discover.length+' shown</span></div><div class="p11-player-grid">'+(discover.length?discover.map(x=>socialPlayerCard(x)).join(''):'<div class="p8-empty">No matching players.</div>')+'</div></section>'+
      (a.connected&&a.username?trustSummaryMarkup().replace('id="p12TrustCenter"','id="p12TrustCenterDialog"'):'')+
      (a.connected&&a.username?'<section class="p11-section p11-preferences"><div><p class="eyebrow">PRIVACY & AVAILABILITY</p><h4>Community preferences</h4><p>Presence is coarse and never exposes your room. Favorites are always private.</p></div><label><input type="checkbox" id="p11AllowChallenges" '+(prefs.allowChallenges!==false?'checked':'')+'> Accept direct challenges</label><label><input type="checkbox" id="p11ShowPresence" '+(prefs.showPresence!==false?'checked':'')+'> Show online / in-game presence</label><button class="btn ghost" id="p11SavePrefs">Save</button></section>':'')+
    '</div>';
  }
  async function loadCommunity(query=model.communityQuery||''){
    model.communityQuery=String(query||'').trim().slice(0,20);
    const a=account(),tasks=[publicGet('/api/community/discover?limit=30'+(model.communityQuery?'&q='+encodeURIComponent(model.communityQuery):''))];
    if(a.connected)tasks.push(accountPost('/api/community/me',{}),accountPost('/api/trust/me',{}));
    const [discover,me,trust]=await Promise.all(tasks);
    model.discover=Array.isArray(discover.players)?discover.players:[];
    if(me)model.community=me;if(trust)model.trust=trust;
    return model.community;
  }
  async function openCommunity(query=model.communityQuery||''){
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(!d.open)d.showModal();
    $('p8CompetitionKicker').textContent='COMMUNITY';$('p8CompetitionTitle').textContent='Players & rivalries';$('p8CompetitionSubtitle').textContent='Lightweight social play · no public follower graph';
    body.innerHTML='<div class="p8-loading">Loading players…</div>';
    try{await loadCommunity(query);renderCommunityDialog();}
    catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load community.')+'</p>';}
  }
  function renderCommunityDialog(){
    const body=$('p8CompetitionDetail');if(!body)return;
    body.innerHTML=communityDialogMarkup();
    const search=$('p11Search'),go=$('p11SearchBtn');if(go)go.onclick=()=>openCommunity(search?.value||'');if(search)search.onkeydown=e=>{if(e.key==='Enter')openCommunity(search.value||'');};
    body.querySelectorAll('[data-p11-profile]').forEach(b=>b.onclick=()=>openCareerProfile(b.dataset.p11Profile));
    body.querySelectorAll('[data-p11-favorite]').forEach(b=>b.onclick=()=>toggleFavorite(b.dataset.p11Favorite,b.dataset.on!=='true'));
    body.querySelectorAll('[data-p11-challenge]').forEach(b=>b.onclick=()=>sendChallenge(b.dataset.p11Challenge,b));
    body.querySelectorAll('[data-p11-ch-action]').forEach(b=>b.onclick=()=>challengeAction(b.dataset.id,b.dataset.p11ChAction,b));
    body.querySelectorAll('[data-p11-ch-open]').forEach(b=>b.onclick=()=>openChallenge(b.dataset.p11ChOpen,b));
    if($('p11SavePrefs'))$('p11SavePrefs').onclick=saveCommunityPreferences;if($('p12TrustCenterDialog'))$('p12TrustCenterDialog').onclick=openTrustCenter;
  }
  async function toggleFavorite(username,favorite){
    try{await accountPost('/api/community/favorite',{username,favorite});notify(favorite?'Player saved to favorites.':'Player removed from favorites.');await loadCommunity(model.communityQuery);renderCommunityDialog();render();}
    catch(err){notify(err?.message||'Could not update favorite.');}
  }
  async function sendChallenge(username,button){
    if(!account().connected){notify('Connect THIEPN Account to send direct challenges.');return;}
    button.disabled=true;
    try{await accountPost('/api/community/challenges',{username});notify('Challenge sent to @'+username+'.');await loadCommunity(model.communityQuery);renderCommunityDialog();render();}
    catch(err){notify(err?.message||'Could not send challenge.');}
    finally{button.disabled=false;}
  }
  async function challengeAction(id,action,button){
    button.disabled=true;
    try{
      const data=await accountPost('/api/community/challenges/'+encodeURIComponent(id),{action});
      if(action==='accept'&&data?.id&&data?.state){const ok=await bridge()?.enterChallenge?.(data);if(ok){$('p8CompetitionDialog')?.close();notify('Challenge accepted.');}}
      else notify(action==='decline'?'Challenge declined.':action==='cancel'?'Challenge cancelled.':'Challenge updated.');
      await loadCommunity(model.communityQuery);if($('p8CompetitionDialog')?.open)renderCommunityDialog();render();
    }catch(err){notify(err?.message||'Challenge action failed.');}
    finally{button.disabled=false;}
  }
  async function openChallenge(id,button){
    button.disabled=true;
    try{const data=await accountPost('/api/community/challenges/'+encodeURIComponent(id)+'/open',{}),ok=await bridge()?.enterChallenge?.(data);if(ok){$('p8CompetitionDialog')?.close();notify('Direct challenge opened.');}}
    catch(err){notify(err?.message||'Could not open challenge.');}
    finally{button.disabled=false;}
  }
  async function saveCommunityPreferences(){
    const button=$('p11SavePrefs');if(button)button.disabled=true;
    try{await accountPost('/api/community/preferences',{allowChallenges:$('p11AllowChallenges')?.checked!==false,showPresence:$('p11ShowPresence')?.checked!==false});notify('Community preferences updated.');await loadCommunity(model.communityQuery);renderCommunityDialog();render();}
    catch(err){notify(err?.message||'Could not save preferences.');}
    finally{if(button)button.disabled=false;}
  }
  function profileSocialMarkup(username,profile,h2h){
    if(!account().connected||String(username).toLowerCase()===String(account().username||'').toLowerCase())return '';
    const fav=favoriteNames().has(String(username).toLowerCase()),record=h2h?.headToHead||null,pres=h2h?.presence||profile?.presence||'offline',blockedByYou=h2h?.blockedByYou===true,interactionAllowed=h2h?.interactionAllowed!==false,canChallenge=(h2h?.canChallenge??profile?.canChallenge)!==false&&interactionAllowed;
    return '<section class="p11-profile-social '+(!interactionAllowed?'is-blocked':'')+'"><div><span class="p11-presence '+esc(pres)+'"></span><div><p class="eyebrow">HEAD TO HEAD</p><h4>'+(record?Number(record.wins||0)+'-'+Number(record.draws||0)+'-'+Number(record.losses||0):'No games yet')+'</h4><span>'+(record?Number(record.games||0)+' recorded games · '+Number(record.ranked||0)+' ranked · '+Number(record.tournament||0)+' tournament':'@'+esc(username)+' is '+esc(presenceLabel(pres).toLowerCase()))+'</span></div></div><div class="p12-profile-actions">'+(interactionAllowed?'<button class="btn ghost" id="p11ProfileFavorite">'+(fav?'★ Favorited':'☆ Favorite')+'</button><button class="btn" id="p11ProfileChallenge" '+(!canChallenge?'disabled':'')+'>Challenge</button>':'<span class="p12-interaction-off">Interaction unavailable</span>')+'<button class="btn ghost" id="p12ProfileReport">Report</button><button class="btn ghost p12-danger" id="p12ProfileBlock">'+(blockedByYou?'Unblock':'Block')+'</button></div></section>';
  }
  function wireProfileSocial(username){
    if($('p11ProfileFavorite'))$('p11ProfileFavorite').onclick=async()=>{const fav=favoriteNames().has(String(username).toLowerCase());try{await accountPost('/api/community/favorite',{username,favorite:!fav});await loadCommunity(model.communityQuery);openCareerProfile(username);}catch(err){notify(err?.message||'Could not update favorite.');}};
    if($('p11ProfileChallenge'))$('p11ProfileChallenge').onclick=async()=>{try{await accountPost('/api/community/challenges',{username});notify('Challenge sent to @'+username+'.');await loadCommunity(model.communityQuery);openCareerProfile(username);}catch(err){notify(err?.message||'Could not send challenge.');}};
    if($('p12ProfileReport'))$('p12ProfileReport').onclick=()=>openReportPlayer(username);
    if($('p12ProfileBlock'))$('p12ProfileBlock').onclick=async()=>{const blocked=$('p12ProfileBlock').textContent==='Unblock';try{await toggleBlock(username,!blocked);openCareerProfile(username);}catch(err){notify(err?.message||'Could not update block.');}};
  }
  function tournamentRow(t){
    const open=t.status==='registration'&&t.joined<t.size,archive=['completed','cancelled'].includes(t.status);
    return '<button class="p8-cup-row" data-p8-open="'+esc(t.id)+'"><span><b>'+esc(t.name)+'</b><small>'+esc(t.id)+' · by @'+esc(t.organizer)+'</small></span><span class="p8-cup-meta"><em data-state="'+esc(t.status)+'">'+esc(t.status)+'</em><strong>'+t.joined+' / '+t.size+'</strong>'+(open?'<small>Open</small>':t.champion?'<small>Champion @'+esc(t.champion)+'</small>':archive?'<small>Archived</small>':'')+'</span></button>';
  }
  function alertControl(){
    const a=account();
    if(!a.connected||!a.username||typeof Notification==='undefined')return '';
    const permission=Notification.permission;
    return '<button class="btn ghost p9-alert-btn" id="p9Alerts" '+(permission==='denied'?'disabled':'')+'>'+(permission==='granted'?'Competition alerts on':permission==='denied'?'Alerts blocked':'Enable competition alerts')+'</button>';
  }
  function render(){
    const host=$('p8CompetitionPanel');if(!host)return;
    const a=account(),cups=model.tournaments||[];
    host.innerHTML='<div class="p8-head"><div><p class="eyebrow">COMPETITIVE PLAY</p><h3>Seasons & tournaments</h3></div><div class="p9-head-actions">'+alertControl()+'<button class="btn ghost" id="p8Refresh">Refresh</button></div></div>'+
      '<p class="p8-intro">Ranked games feed quarterly seasons. Renju cups use account-bound rooms, automatic check-in deadlines, live spectating, and server-authoritative brackets without changing Elo.</p>'+
      (model.error?'<p class="p8-error">'+esc(model.error)+'</p>':'')+
      seasonMarkup()+
      careerMarkup()+
      communitySummaryMarkup()+
      trustSummaryMarkup()+
      '<div class="p8-cups-head"><div><p class="eyebrow">RENJU CUPS</p><h4>'+(model.scope==='archive'?'Tournament archive':'Live tournaments')+'</h4></div><div class="p9-scope-tabs"><button data-p9-scope="live" aria-pressed="'+(model.scope==='live')+'">Live</button><button data-p9-scope="archive" aria-pressed="'+(model.scope==='archive')+'">Archive</button></div></div>'+
      (model.scope==='live'?'<div class="p8-create">'+(a.connected&&a.username?
        '<input id="p8CupName" maxlength="48" placeholder="Tournament name" aria-label="Tournament name"><select id="p8CupSize" aria-label="Tournament size"><option value="4">4 players</option><option value="8" selected>8 players</option></select><button class="btn" id="p8CreateCup">Create cup</button>':
        '<p>Connect THIEPN Account and create a public username to enter or create tournaments.</p>')+'</div>':'')+
      '<div class="p8-cup-list">'+(cups.length?cups.map(tournamentRow).join(''):'<div class="p8-empty">'+(model.scope==='archive'?'No completed or cancelled tournaments yet.':'No live tournaments yet. Create the first cup.')+'</div>')+'</div>';
    $('p8Refresh').onclick=()=>refresh(true);
    if($('p8CreateCup'))$('p8CreateCup').onclick=createCup;
    if($('p9Alerts'))$('p9Alerts').onclick=enableAlerts;
    if($('p9SeasonHistory'))$('p9SeasonHistory').onclick=openSeasonHistory;
    if($('p10Career'))$('p10Career').onclick=()=>openCareerProfile();
    if($('p11Community'))$('p11Community').onclick=()=>openCommunity();if($('p12TrustCenter'))$('p12TrustCenter').onclick=openTrustCenter;
    host.querySelectorAll('[data-p11-profile]').forEach(b=>b.onclick=()=>openCareerProfile(b.dataset.p11Profile));
    host.querySelectorAll('[data-p9-season]').forEach(b=>b.onclick=()=>openSeason(b.dataset.p9Season));
    host.querySelectorAll('[data-p9-scope]').forEach(b=>b.onclick=()=>{model.scope=b.dataset.p9Scope;refresh(true);});
    host.querySelectorAll('[data-p8-open]').forEach(b=>b.onclick=()=>openCup(b.dataset.p8Open));
  }
  async function enableAlerts(){
    if(typeof Notification==='undefined'||Notification.permission==='denied')return;
    try{await Notification.requestPermission();render();if(Notification.permission==='granted')notify('Tournament match alerts enabled.');}catch{}
  }
  function detectAssignments(me){
    if(!me?.tournaments?.length)return;
    const seen=notifiedSet();
    for(const t of me.tournaments){
      const m=t.you?.activeMatch;
      if(!m?.roomId||m.status!=='active')continue;
      const key=t.id+':'+m.id;
      if(seen.has(key))continue;
      seen.add(key);
      const msg='Tournament match ready vs @'+(m.opponent||'opponent');
      notify(msg);
      if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
        try{new Notification(t.name||'Gomoku tournament',{body:msg,tag:'gomoku-tournament-'+key,renotify:false});}catch{}
      }
    }
    saveNotified(seen);
  }
  function detectChallenges(community){
    const incoming=(community?.challenges||[]).filter(x=>x.direction==='incoming'&&x.status==='pending'),seen=notifiedSet();
    for(const ch of incoming){const key='challenge:'+ch.id;if(seen.has(key))continue;seen.add(key);const msg='Direct challenge from @'+ch.other;notify(msg);if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification('Gomoku challenge',{body:msg,tag:'gomoku-'+key,renotify:false});}catch{}}}
    saveNotified(seen);
  }
  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    if(!mounted||document.hidden)return;
    refreshTimer=setTimeout(()=>refresh(false),25000);
  }
  async function refresh(force=false){
    if(model.loading&&!force){scheduleRefresh();return;}model.loading=true;model.error='';
    try{
      const a=account(),base=[publicGet('/api/seasons/current?limit=20'),publicGet('/api/seasons?limit=8'),publicGet('/api/tournaments?scope='+encodeURIComponent(model.scope)+'&limit=50')];
      const [season,seasons,cups]=await Promise.all(base);
      let me=null,community=null,trust=null,discover=null;
      if(a.connected)[me,community,trust,discover]=await Promise.all([accountPost('/api/competition/me',{}),accountPost('/api/community/me',{}),accountPost('/api/trust/me',{}),publicGet('/api/community/discover?limit=12')]);
      else discover=await publicGet('/api/community/discover?limit=12');
      model.season=season.season||null;model.seasonPlayers=Array.isArray(season.players)?season.players:[];model.seasons=Array.isArray(seasons.seasons)?seasons.seasons:[];model.tournaments=Array.isArray(cups.tournaments)?cups.tournaments:[];model.me=me||null;model.community=community||null;model.trust=trust||null;model.discover=Array.isArray(discover?.players)?discover.players:[];
      if(me)detectAssignments(me);if(community)detectChallenges(community);
    }catch(err){model.error=err?.message||'Competition data could not be loaded.';}
    finally{model.loading=false;render();scheduleRefresh();}
  }
  async function createCup(){
    const name=$('p8CupName')?.value?.trim()||'',size=Number($('p8CupSize')?.value)||8,button=$('p8CreateCup');
    if(name.length<3){notify('Use at least 3 characters for the tournament name.');return;}
    if(button)button.disabled=true;
    try{const data=await accountPost('/api/tournaments',{name,size});notify('Tournament created.');await refresh(true);if(data?.tournament?.id)await openCup(data.tournament.id);}
    catch(err){notify(err?.message||'Could not create tournament.');}
    finally{if(button)button.disabled=false;}
  }
  function roundName(round,total){if(round===total)return 'Final';if(round===total-1)return 'Semifinals';return 'Round '+round;}
  function liveDot(online){return '<i class="p9-live-dot '+(online?'is-online':'')+'" aria-hidden="true"></i>';}
  function matchMarkup(m,isOrganizer,total){
    const controls=[];
    if(m.roomId&&m.status==='active')controls.push('<button class="btn ghost p9-watch" data-p9-watch="'+esc(m.roomId)+'">Watch</button>');
    if(isOrganizer&&m.status==='active'&&!m.startedAt){
      controls.push('<button class="btn ghost" data-p9-op="extend" data-match="'+esc(m.id)+'">+10 min</button>');
      if(m.deadlineMissed){
        if(m.player1)controls.push('<button class="btn ghost p9-ruling" data-p9-op="forfeit" data-match="'+esc(m.id)+'" data-player="'+esc(m.player1)+'">Award @'+esc(m.player1)+'</button>');
        if(m.player2)controls.push('<button class="btn ghost p9-ruling" data-p9-op="forfeit" data-match="'+esc(m.id)+'" data-player="'+esc(m.player2)+'">Award @'+esc(m.player2)+'</button>');
      }
    }
    return '<div class="p8-match '+(m.deadlineMissed?'is-overdue':'')+'" data-state="'+esc(m.status)+'"><div class="p9-match-players"><span>'+liveDot(m.player1Online)+(m.player1CheckedIn?'✓ ':'')+esc(m.player1||'TBD')+'</span><b>vs</b><span>'+liveDot(m.player2Online)+(m.player2CheckedIn?'✓ ':'')+esc(m.player2||'TBD')+'</span></div><div class="p9-match-meta"><small>'+esc(deadlineLabel(m))+(m.spectatorCount?' · '+m.spectatorCount+' watching':'')+(m.winner?' · winner @'+esc(m.winner):'')+'</small></div>'+(controls.length?'<div class="p9-match-actions">'+controls.join('')+'</div>':'')+'</div>';
  }
  function timelineMarkup(t){
    const events=(t.events||[]).slice(0,20);
    if(!events.length)return '<div class="p8-empty">Event activity will appear here.</div>';
    return '<div class="p9-timeline">'+events.map(e=>'<div class="p9-event"><i></i><div><b>'+esc(eventLabel(e.type))+'</b><span>'+(e.subject?'@'+esc(e.subject)+' · ':'')+(e.round?'R'+e.round+(e.slot?' · M'+e.slot:'')+' · ':'')+esc(e.message||'')+'</span></div><time>'+fmtTime(e.createdAt)+'</time></div>').join('')+'</div>';
  }
  function detailMarkup(t){
    const a=account(),you=t.you||{},isOrganizer=you.isOrganizer===true,total=Math.log2(Number(t.size)||8),byRound=new Map();
    for(const m of t.matches||[]){if(!byRound.has(m.round))byRound.set(m.round,[]);byRound.get(m.round).push(m);}
    const bracket=[...byRound.entries()].map(([round,matches])=>'<section class="p8-round"><h4>'+roundName(Number(round),total)+'</h4>'+matches.map(m=>matchMarkup(m,isOrganizer,total)).join('')+'</section>').join('');
    const entries=(t.entries||[]).map(e=>'<span class="p8-entry '+(e.eliminated?'is-out':'')+'">'+(e.seed?'#'+e.seed+' ':'')+'@'+esc(e.username)+(isOrganizer&&t.status==='registration'&&e.username!==t.organizer?'<button title="Remove player" data-p9-remove="'+esc(e.username)+'">×</button>':'')+'</span>').join('');
    let action='';
    if(!a.connected||!a.username)action='<p class="p8-action-note">Connect THIEPN Account to participate. Spectating is public.</p>';
    else if(t.status==='registration'&&!you.joined&&t.joined<t.size)action='<button class="btn" data-p8-action="join">Join tournament</button>';
    else if(t.status==='registration'&&you.joined&&!isOrganizer)action='<button class="btn ghost" data-p8-action="leave">Leave tournament</button>';
    else if(t.status==='registration'&&you.joined)action='<p class="p8-action-note">You are registered. The bracket starts automatically when all '+t.size+' places are filled.</p>';
    else if(t.status==='active'&&you.activeMatch?.roomId)action='<button class="btn" data-p8-action="play">'+(you.activeMatch.checkedIn?'Open my match':'Check in & open match')+'</button><span class="p9-opponent-state">'+(you.activeMatch.opponentCheckedIn?'Opponent checked in':'Waiting for opponent check-in')+'</span>';
    else if(t.status==='active'&&you.eliminated)action='<p class="p8-action-note">You have been eliminated. Live bracket matches remain watchable.</p>';
    else if(t.status==='active'&&you.joined)action='<p class="p8-action-note">Waiting for your next bracket match.</p>';
    else if(t.status==='completed')action='<p class="p8-action-note">Champion: '+(t.champion?'@'+esc(t.champion):'—')+'</p>';
    else if(t.status==='cancelled')action='<p class="p8-action-note">Tournament cancelled'+(t.cancelReason?': '+esc(t.cancelReason):'.')+'</p>';
    const organizer=t.status==='registration'&&isOrganizer?'<section class="p9-organizer"><div><p class="eyebrow">ORGANIZER</p><h4>Event controls</h4></div><div class="p9-rename"><input id="p9RenameCup" maxlength="48" value="'+esc(t.name)+'" aria-label="Tournament name"><button class="btn ghost" data-p9-op="rename">Rename</button></div><button class="btn ghost p9-danger" data-p9-op="cancel">Cancel tournament</button></section>':t.status==='active'&&isOrganizer?'<section class="p9-organizer"><div><p class="eyebrow">ORGANIZER</p><h4>Event controls</h4><p>One-sided no-shows are forfeited automatically after the check-in deadline. If neither player appears, extend the deadline or award the match from the bracket.</p></div><button class="btn ghost p9-danger" data-p9-op="cancel">Cancel tournament</button></section>':'';
    return '<div class="p8-detail-top"><div><span class="p8-status" data-state="'+esc(t.status)+'">'+esc(t.status)+'</span><strong>'+t.joined+' / '+t.size+' players</strong></div><p>Organizer @'+esc(t.organizer)+' · Renju · single elimination · unrated</p><div class="p8-detail-actions">'+action+'</div></div>'+
      organizer+
      '<section class="p8-entry-block"><h4>Players</h4><div>'+entries+'</div></section>'+
      '<section class="p8-bracket"><div class="p8-bracket-track">'+(bracket||'<div class="p8-empty">The bracket appears when registration fills.</div>')+'</div></section>'+
      '<section class="p9-events"><div class="p9-section-head"><div><p class="eyebrow">EVENT LOG</p><h4>What happened</h4></div><button class="btn ghost" data-p9-refresh-detail>Refresh</button></div>'+timelineMarkup(t)+'</section>';
  }
  async function fetchCup(id){const data=await publicGet('/api/tournaments/'+encodeURIComponent(id));return data.tournament;}
  async function openCup(id){
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(body)body.innerHTML='<div class="p8-loading">Loading tournament…</div>';
    if(!d.open)d.showModal();
    try{
      let t=await fetchCup(id);
      if(account().connected){try{t=await bridge().detail?.(id)||t;}catch{}}
      model.detail=t;$('p8CompetitionKicker').textContent='TOURNAMENT';$('p8CompetitionTitle').textContent=t.name;$('p8CompetitionSubtitle').textContent=t.id+' · '+t.status;body.innerHTML=detailMarkup(t);
      wireDetail(t);
    }catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load tournament.')+'</p>';}
  }
  function wireDetail(t){
    const body=$('p8CompetitionDetail');if(!body)return;
    body.querySelectorAll('[data-p8-action]').forEach(b=>b.onclick=()=>cupAction(t.id,b.dataset.p8Action,b));
    body.querySelectorAll('[data-p9-watch]').forEach(b=>b.onclick=()=>watchMatch(t.id,b.dataset.p9Watch,b));
    body.querySelectorAll('[data-p9-remove]').forEach(b=>b.onclick=()=>organizerAction(t.id,'remove_player',{targetUsername:b.dataset.p9Remove},b));
    body.querySelectorAll('[data-p9-op="extend"]').forEach(b=>b.onclick=()=>organizerAction(t.id,'extend_deadline',{matchId:b.dataset.match},b));
    body.querySelectorAll('[data-p9-op="forfeit"]').forEach(b=>b.onclick=()=>organizerAction(t.id,'award_forfeit',{matchId:b.dataset.match,targetUsername:b.dataset.player},b,true));
    const rename=body.querySelector('[data-p9-op="rename"]');if(rename)rename.onclick=()=>organizerAction(t.id,'rename',{text:$('p9RenameCup')?.value||''},rename);
    const cancel=body.querySelector('[data-p9-op="cancel"]');if(cancel)cancel.onclick=()=>organizerAction(t.id,'cancel',{text:'Cancelled by organizer'},cancel,true);
    const refresh=body.querySelector('[data-p9-refresh-detail]');if(refresh)refresh.onclick=()=>openCup(t.id);
  }
  async function watchMatch(tournamentId,roomId,button){
    button.disabled=true;
    try{const ok=await bridge()?.spectateTournament?.(roomId);if(ok){$('p8CompetitionDialog')?.close();notify('Watching tournament match.');}}
    catch(err){notify(err?.message||'Could not open spectator view.');}
    finally{button.disabled=false;}
  }
  async function organizerAction(id,action,payload,button,confirmAction=false){
    if(confirmAction){
      const label=action==='cancel'?'Cancel this tournament?':'Award this match by forfeit?';
      if(!window.confirm(label))return;
    }
    button.disabled=true;
    try{const data=await accountPost('/api/tournaments/'+id+'/organizer',{action,...payload});model.detail=data.tournament;notify(action==='extend_deadline'?'Deadline extended.':'Tournament updated.');await refresh(true);await openCup(id);}
    catch(err){notify(err?.message||'Organizer action failed.');}
    finally{button.disabled=false;}
  }
  async function cupAction(id,action,button){
    button.disabled=true;
    try{
      if(action==='join'){const data=await accountPost('/api/tournaments/'+id+'/join',{});model.detail=data.tournament;notify('Tournament joined.');}
      else if(action==='leave'){const data=await accountPost('/api/tournaments/'+id+'/leave',{});model.detail=data.tournament;notify('Tournament left.');}
      else if(action==='play'){const data=await accountPost('/api/tournaments/'+id+'/play',{});const ok=await bridge().enterTournament(data);if(ok){$('p8CompetitionDialog')?.close();notify(data.match?.bothCheckedIn?'Both players checked in.':'You are checked in.');return;}}
      await refresh(true);await openCup(id);
    }catch(err){notify(err?.message||'Tournament action failed.');}
    finally{button.disabled=false;}
  }
  async function openSeason(code){
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(!d.open)d.showModal();body.innerHTML='<div class="p8-loading">Loading standings…</div>';
    try{const data=await publicGet('/api/seasons/'+encodeURIComponent(code)+'?limit=100'),s=data.season,players=data.players||[];$('p8CompetitionKicker').textContent='SEASON';$('p8CompetitionTitle').textContent=s.name;$('p8CompetitionSubtitle').textContent=fmtDate(s.startsAt)+' – '+fmtDate(s.endsAt)+(s.champion?' · champion @'+s.champion:'');body.innerHTML='<section class="p9-full-standings">'+(players.length?players.map(p=>'<div class="p9-standing-row"><b>#'+p.rank+'</b><span>@'+esc(p.username)+'</span><strong>'+p.points+' pts</strong><small>'+p.wins+'-'+p.draws+'-'+p.losses+'</small><em>'+p.rating+' <i>'+(p.ratingDelta>0?'+':'')+p.ratingDelta+'</i></em></div>').join(''):'<div class="p8-empty">No ranked games in this season.</div>')+'</section>';}catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load season.')+'</p>';}
  }
  function openSeasonHistory(){
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(!d.open)d.showModal();$('p8CompetitionKicker').textContent='SEASONS';$('p8CompetitionTitle').textContent='Season history';$('p8CompetitionSubtitle').textContent='Quarterly ranked archives';const rows=model.seasons||[];body.innerHTML='<div class="p9-season-history">'+rows.map(s=>'<button data-p9-open-season="'+esc(s.code)+'"><span><b>'+esc(s.name)+'</b><small>'+fmtDate(s.startsAt)+' – '+fmtDate(s.endsAt)+'</small></span><span><em data-state="'+esc(s.status)+'">'+esc(s.status)+'</em>'+(s.champion?'<small>Champion @'+esc(s.champion)+'</small>':'')+'</span></button>').join('')+'</div>';body.querySelectorAll('[data-p9-open-season]').forEach(b=>b.onclick=()=>openSeason(b.dataset.p9OpenSeason));
  }
  function renderRoomBanner(){
    const info=bridge()?.room?.(),hud=$('roomMatchHud');if(!hud)return;
    let report=$('p12RoomTrustAction');const me=String(info?.state?.you?.profileUsername||''),opponent=(info?.state?.players||[]).find(p=>String(p.profileUsername||'')&&String(p.profileUsername)!==me)?.profileUsername||'';
    if(info?.role==='player'&&account().connected&&opponent){if(!report){report=document.createElement('button');report.id='p12RoomTrustAction';report.className='btn ghost p12-room-report';report.textContent='Report opponent';hud.append(report);}report.onclick=()=>{const done=!!(info.state.game?.result||info.state.game?.terminal);openReportPlayer(opponent,done?{roomId:info.id,gameVersion:Number(info.state.gameVersion)||1}:{});};}else if(report)report.remove();
    let banner=$('p9TournamentRoomBanner'),t=info?.state?.tournament,ch=info?.state?.challenge;
    if(!t&&!ch){if(banner)banner.remove();return;}
    if(!banner){banner=document.createElement('div');banner.id='p9TournamentRoomBanner';banner.className='p9-room-banner';hud.prepend(banner);}
    if(ch){
      const you=String(info.state.you?.profileUsername||''),other=(info.state.players||[]).find(p=>String(p.profileUsername||'')&&String(p.profileUsername)!==you)?.profileUsername||'Opponent',done=!!(info.state.game?.result||info.state.game?.terminal);
      banner.innerHTML='<div><span class="eyebrow">DIRECT CHALLENGE</span><b>'+(done?'Challenge game complete':'Playing @'+esc(other))+'</b><small>Private account-bound Renju match</small></div><button class="btn ghost" id="p11OpponentProfile">Opponent profile</button>';
      $('p11OpponentProfile').onclick=()=>openCareerProfile(other);return;
    }
    const ops=info.state.tournamentOps||{},spectator=info.role==='spectator',status=info.state.game?.result||info.state.game?.terminal?'Result recorded':ops.startedAt?'Match in progress':ops.youCheckedIn===true?(ops.opponentCheckedIn?'Both players checked in':'Checked in · waiting for opponent'):'Tournament match';
    banner.innerHTML='<div><span class="eyebrow">TOURNAMENT · ROUND '+esc(t.round)+' · MATCH '+esc(t.slot)+'</span><b>'+esc(status)+'</b><small>'+(spectator?'Spectating · ':'')+(ops.readyDeadline&&!ops.startedAt?'check-in deadline '+fmtTime(ops.readyDeadline)+' · ':'')+(Number(info.state.spectatorCount)||0)+' watching</small></div><button class="btn ghost" id="p9ViewBracket">View bracket</button>';
    $('p9ViewBracket').onclick=()=>openCup(t.id);
  }
  function startRoomDecoration(){clearInterval(roomTimer);roomTimer=setInterval(renderRoomBanner,1200);renderRoomBanner();}
  function mount(){
    const ranked=$('roomRankedPanel');if(!ranked)return false;
    if(!$('p8CompetitionPanel')){const panel=document.createElement('section');panel.id='p8CompetitionPanel';panel.className='room-ranked-panel p8-competition-panel';ranked.insertAdjacentElement('afterend',panel);}
    mounted=true;render();refresh(true);startRoomDecoration();return true;
  }
  const observer=new MutationObserver(()=>{if(!mounted||!$('p8CompetitionPanel'))mount();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const boot=()=>{if(!mount())setTimeout(boot,250);};boot();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('p8CompetitionPanel'))refresh(true);else clearTimeout(refreshTimer);});
  window.addEventListener('beforeunload',()=>{clearTimeout(refreshTimer);clearInterval(roomTimer);});
  window.GomokuCompetition=Object.freeze({version:'5.0.0',refresh:()=>refresh(true),openTournament:openCup,openSeason,openPlayerProfile:openCareerProfile,openCommunity,openTrustCenter,reportPlayer:openReportPlayer});
})();
