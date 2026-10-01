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
  let model={season:null,seasonPlayers:[],seasons:[],tournaments:[],detail:null,me:null,scope:'live',loading:false,error:''},mounted=false,refreshTimer=0,roomTimer=0;

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
  function tournamentRow(t){
    const open=t.status==='registration'&&t.joined<t.size,archive=['completed','cancelled'].includes(t.status);
    return '<button class="p8-cup-row" data-p8-open="'+esc(t.id)+'"><span><b>'+esc(t.name)+'</b><small>'+esc(t.id)+' · by @'+esc(t.organizer)+'</small></span><span class="p8-cup-meta"><em data-state="'+esc(t.status)+'">'+esc(t.status)+'</em><strong>'+t.joined+' / '+t.size+'</strong>'+(open?'<small>Open</small>':t.champion?'<small>Champion @'+esc(t.champion)+'</small>':archive?'<small>Archived</small>':'')+'</span></button>';
  }
  function alertControl(){
    const a=account();
    if(!a.connected||!a.username||typeof Notification==='undefined')return '';
    const permission=Notification.permission;
    return '<button class="btn ghost p9-alert-btn" id="p9Alerts" '+(permission==='denied'?'disabled':'')+'>'+(permission==='granted'?'Match alerts on':permission==='denied'?'Alerts blocked':'Enable match alerts')+'</button>';
  }
  function render(){
    const host=$('p8CompetitionPanel');if(!host)return;
    const a=account(),cups=model.tournaments||[];
    host.innerHTML='<div class="p8-head"><div><p class="eyebrow">COMPETITIVE PLAY</p><h3>Seasons & tournaments</h3></div><div class="p9-head-actions">'+alertControl()+'<button class="btn ghost" id="p8Refresh">Refresh</button></div></div>'+
      '<p class="p8-intro">Ranked games feed quarterly seasons. Renju cups use account-bound rooms, automatic check-in deadlines, live spectating, and server-authoritative brackets without changing Elo.</p>'+
      (model.error?'<p class="p8-error">'+esc(model.error)+'</p>':'')+
      seasonMarkup()+
      '<div class="p8-cups-head"><div><p class="eyebrow">RENJU CUPS</p><h4>'+(model.scope==='archive'?'Tournament archive':'Live tournaments')+'</h4></div><div class="p9-scope-tabs"><button data-p9-scope="live" aria-pressed="'+(model.scope==='live')+'">Live</button><button data-p9-scope="archive" aria-pressed="'+(model.scope==='archive')+'">Archive</button></div></div>'+
      (model.scope==='live'?'<div class="p8-create">'+(a.connected&&a.username?
        '<input id="p8CupName" maxlength="48" placeholder="Tournament name" aria-label="Tournament name"><select id="p8CupSize" aria-label="Tournament size"><option value="4">4 players</option><option value="8" selected>8 players</option></select><button class="btn" id="p8CreateCup">Create cup</button>':
        '<p>Connect THIEPN Account and create a public username to enter or create tournaments.</p>')+'</div>':'')+
      '<div class="p8-cup-list">'+(cups.length?cups.map(tournamentRow).join(''):'<div class="p8-empty">'+(model.scope==='archive'?'No completed or cancelled tournaments yet.':'No live tournaments yet. Create the first cup.')+'</div>')+'</div>';
    $('p8Refresh').onclick=()=>refresh(true);
    if($('p8CreateCup'))$('p8CreateCup').onclick=createCup;
    if($('p9Alerts'))$('p9Alerts').onclick=enableAlerts;
    if($('p9SeasonHistory'))$('p9SeasonHistory').onclick=openSeasonHistory;
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
  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    if(!mounted||document.hidden)return;
    refreshTimer=setTimeout(()=>refresh(false),25000);
  }
  async function refresh(force=false){
    if(model.loading&&!force){scheduleRefresh();return;}model.loading=true;model.error='';
    try{
      const tasks=[publicGet('/api/seasons/current?limit=20'),publicGet('/api/seasons?limit=8'),publicGet('/api/tournaments?scope='+encodeURIComponent(model.scope)+'&limit=50')];
      if(account().connected)tasks.push(accountPost('/api/competition/me',{}));
      const [season,seasons,cups,me]=await Promise.all(tasks);
      model.season=season.season||null;model.seasonPlayers=Array.isArray(season.players)?season.players:[];model.seasons=Array.isArray(seasons.seasons)?seasons.seasons:[];model.tournaments=Array.isArray(cups.tournaments)?cups.tournaments:[];model.me=me||null;
      if(me)detectAssignments(me);
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
    const info=bridge()?.room?.(),hud=$('roomMatchHud');
    if(!hud)return;
    let banner=$('p9TournamentRoomBanner');
    if(!info?.state?.tournament){if(banner)banner.remove();return;}
    if(!banner){banner=document.createElement('div');banner.id='p9TournamentRoomBanner';banner.className='p9-room-banner';hud.prepend(banner);}
    const t=info.state.tournament,ops=info.state.tournamentOps||{},spectator=info.role==='spectator',status=info.state.game?.result||info.state.game?.terminal?'Result recorded':ops.startedAt?'Match in progress':ops.youCheckedIn===true?(ops.opponentCheckedIn?'Both players checked in':'Checked in · waiting for opponent'):'Tournament match';
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
  window.GomokuCompetition=Object.freeze({version:'2.0.0',refresh:()=>refresh(true),openTournament:openCup,openSeason});
})();
