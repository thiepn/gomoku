/* P8 — Competitive Seasons & Tournaments. Presentation/client orchestration only. */
(() => {
  'use strict';
  if (window.GomokuCompetition) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = value => { try { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)); } catch { return String(value||''); } };
  const bridge = () => window.GomokuCompetitionBridge || null;
  let model={season:null,seasonPlayers:[],tournaments:[],detail:null,loading:false,error:''},mounted=false,refreshTimer=0;

  async function publicGet(path){const b=bridge();if(!b)throw Error('Competition services are still loading.');return b.publicGet(path);}
  async function accountPost(path,body={}){const b=bridge();if(!b)throw Error('Competition services are still loading.');return b.accountPost(path,body);}
  function account(){return bridge()?.account?.()||{connected:false,username:null};}
  function notify(message){try{bridge()?.toast?.(message);}catch{}}

  function ensureDialog(){
    if($('p8CompetitionDialog'))return $('p8CompetitionDialog');
    const d=document.createElement('dialog');d.id='p8CompetitionDialog';d.className='p8-competition-dialog';d.setAttribute('aria-labelledby','p8CompetitionTitle');
    d.innerHTML='<div class="p8-competition-shell"><header><div><p class="eyebrow">COMPETITION</p><h2 id="p8CompetitionTitle">Tournament</h2><p id="p8CompetitionSubtitle"></p></div><button class="p8-close" id="p8CompetitionClose" aria-label="Close">×</button></header><div id="p8CompetitionDetail"></div></div>';
    document.body.append(d);$('p8CompetitionClose').onclick=()=>d.close();return d;
  }
  function seasonMarkup(){
    const s=model.season,players=model.seasonPlayers||[];
    if(!s)return '<div class="p8-empty">No ranked season is active.</div>';
    const top=players.slice(0,5).map(p=>'<div class="p8-standing"><b>#'+p.rank+'</b><span>@'+esc(p.username)+'</span><strong>'+p.points+' pts</strong><small>'+p.rating+' rating</small></div>').join('');
    return '<div class="p8-season-card"><div><p class="eyebrow">CURRENT SEASON</p><h4>'+esc(s.name)+'</h4><span>'+fmtDate(s.startsAt)+' – '+fmtDate(s.endsAt)+'</span></div><div class="p8-season-board">'+(top||'<p class="tiny">No ranked games recorded this season yet.</p>')+'</div></div>';
  }
  function tournamentRow(t){
    const open=t.status==='registration'&&t.joined<t.size;
    return '<button class="p8-cup-row" data-p8-open="'+esc(t.id)+'"><span><b>'+esc(t.name)+'</b><small>'+esc(t.id)+' · by @'+esc(t.organizer)+'</small></span><span class="p8-cup-meta"><em data-state="'+esc(t.status)+'">'+esc(t.status)+'</em><strong>'+t.joined+' / '+t.size+'</strong>'+(open?'<small>Open</small>':t.champion?'<small>Champion @'+esc(t.champion)+'</small>':'')+'</span></button>';
  }
  function render(){
    const host=$('p8CompetitionPanel');if(!host)return;
    const a=account(),cups=model.tournaments||[];
    host.innerHTML='<div class="p8-head"><div><p class="eyebrow">COMPETITIVE PLAY</p><h3>Seasons & tournaments</h3></div><button class="btn ghost" id="p8Refresh">Refresh</button></div>'+
      '<p class="p8-intro">Ranked games feed the seasonal table. Tournaments are separate single-elimination Renju cups and do not change Elo.</p>'+
      (model.error?'<p class="p8-error">'+esc(model.error)+'</p>':'')+
      seasonMarkup()+
      '<div class="p8-cups-head"><div><p class="eyebrow">RENJU CUPS</p><h4>Live tournaments</h4></div><span>'+cups.length+' listed</span></div>'+
      '<div class="p8-create">'+(a.connected&&a.username?
        '<input id="p8CupName" maxlength="48" placeholder="Tournament name" aria-label="Tournament name"><select id="p8CupSize" aria-label="Tournament size"><option value="4">4 players</option><option value="8" selected>8 players</option></select><button class="btn" id="p8CreateCup">Create cup</button>':
        '<p>Connect THIEPN Account and create a public username to enter or create tournaments.</p>')+'</div>'+
      '<div class="p8-cup-list">'+(cups.length?cups.map(tournamentRow).join(''):'<div class="p8-empty">No tournaments yet. Create the first cup.</div>')+'</div>';
    $('p8Refresh').onclick=()=>refresh(true);
    if($('p8CreateCup'))$('p8CreateCup').onclick=createCup;
    host.querySelectorAll('[data-p8-open]').forEach(b=>b.onclick=()=>openCup(b.dataset.p8Open));
  }
  async function refresh(force=false){
    if(model.loading&&!force)return;model.loading=true;model.error='';
    try{
      const [season,cups]=await Promise.all([publicGet('/api/seasons/current?limit=20'),publicGet('/api/tournaments')]);
      model.season=season.season||null;model.seasonPlayers=Array.isArray(season.players)?season.players:[];model.tournaments=Array.isArray(cups.tournaments)?cups.tournaments:[];
    }catch(err){model.error=err?.message||'Competition data could not be loaded.';}
    finally{model.loading=false;render();}
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
  function detailMarkup(t){
    const a=account(),you=t.you,total=Math.log2(Number(t.size)||8),byRound=new Map();
    for(const m of t.matches||[]){if(!byRound.has(m.round))byRound.set(m.round,[]);byRound.get(m.round).push(m);}
    const bracket=[...byRound.entries()].map(([round,matches])=>'<section class="p8-round"><h4>'+roundName(Number(round),total)+'</h4>'+matches.map(m=>'<div class="p8-match" data-state="'+esc(m.status)+'"><div><span>'+esc(m.player1||'TBD')+'</span><b>vs</b><span>'+esc(m.player2||'TBD')+'</span></div><small>'+(m.winner?'Winner @'+esc(m.winner):m.status==='active'?'Match ready':m.status==='completed'?'Completed':'Waiting')+'</small></div>').join('')+'</section>').join('');
    const entries=(t.entries||[]).map(e=>'<span class="p8-entry '+(e.eliminated?'is-out':'')+'">'+(e.seed?'#'+e.seed+' ':'')+'@'+esc(e.username)+'</span>').join('');
    let action='';
    if(!a.connected||!a.username)action='<p class="p8-action-note">Connect THIEPN Account to participate.</p>';
    else if(t.status==='registration'&&!you?.joined&&t.joined<t.size)action='<button class="btn" data-p8-action="join">Join tournament</button>';
    else if(t.status==='registration'&&you?.joined&&a.username!==t.organizer)action='<button class="btn ghost" data-p8-action="leave">Leave tournament</button>';
    else if(t.status==='registration'&&you?.joined)action='<p class="p8-action-note">You are registered. The bracket starts automatically when all '+t.size+' places are filled.</p>';
    else if(t.status==='active'&&you?.activeMatch?.roomId)action='<button class="btn" data-p8-action="play">Open my match</button>';
    else if(t.status==='active'&&you?.eliminated)action='<p class="p8-action-note">You have been eliminated. The bracket remains available to spectate.</p>';
    else if(t.status==='active'&&you?.joined)action='<p class="p8-action-note">Waiting for the next bracket match.</p>';
    else if(t.status==='completed')action='<p class="p8-action-note">Champion: '+(t.champion?'@'+esc(t.champion):'—')+'</p>';
    return '<div class="p8-detail-top"><div><span class="p8-status" data-state="'+esc(t.status)+'">'+esc(t.status)+'</span><strong>'+t.joined+' / '+t.size+' players</strong></div><p>Organizer @'+esc(t.organizer)+' · Renju · single elimination · unrated</p><div class="p8-detail-actions">'+action+'</div></div>'+
      '<section class="p8-entry-block"><h4>Players</h4><div>'+entries+'</div></section>'+
      '<section class="p8-bracket"><div class="p8-bracket-track">'+(bracket||'<div class="p8-empty">The bracket appears when registration fills.</div>')+'</div></section>';
  }
  async function fetchCup(id){const data=await publicGet('/api/tournaments/'+encodeURIComponent(id));return data.tournament;}
  async function openCup(id){
    const d=ensureDialog(),body=$('p8CompetitionDetail');if(body)body.innerHTML='<div class="p8-loading">Loading tournament…</div>';
    if(!d.open)d.showModal();
    try{
      // Public detail is enough for browsing. Authenticated actions refresh personalized state through play/join responses.
      let t=await fetchCup(id);
      if(account().connected){
        try{
          // GET accepts the account token only through the bridge's authenticated detail helper when available.
          t=await bridge().detail?.(id) || t;
        }catch{}
      }
      model.detail=t;$('p8CompetitionTitle').textContent=t.name;$('p8CompetitionSubtitle').textContent=t.id+' · '+t.status;body.innerHTML=detailMarkup(t);
      body.querySelectorAll('[data-p8-action]').forEach(b=>b.onclick=()=>cupAction(t.id,b.dataset.p8Action,b));
    }catch(err){body.innerHTML='<p class="p8-error">'+esc(err?.message||'Could not load tournament.')+'</p>';}
  }
  async function cupAction(id,action,button){
    button.disabled=true;
    try{
      if(action==='join'){const data=await accountPost('/api/tournaments/'+id+'/join',{});model.detail=data.tournament;notify('Tournament joined.');}
      else if(action==='leave'){const data=await accountPost('/api/tournaments/'+id+'/leave',{});model.detail=data.tournament;notify('Tournament left.');}
      else if(action==='play'){const data=await accountPost('/api/tournaments/'+id+'/play',{});const ok=await bridge().enterTournament(data);if(ok){$('p8CompetitionDialog')?.close();notify('Tournament match opened.');return;}}
      await refresh(true);await openCup(id);
    }catch(err){notify(err?.message||'Tournament action failed.');}
    finally{button.disabled=false;}
  }
  function mount(){
    const ranked=$('roomRankedPanel');if(!ranked)return false;
    if(!$('p8CompetitionPanel')){const panel=document.createElement('section');panel.id='p8CompetitionPanel';panel.className='room-ranked-panel p8-competition-panel';ranked.insertAdjacentElement('afterend',panel);}
    mounted=true;render();refresh();return true;
  }
  const observer=new MutationObserver(()=>{if(!mounted||!$('p8CompetitionPanel'))mount();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  const boot=()=>{if(!mount())setTimeout(boot,250);};boot();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('p8CompetitionPanel'))refresh();});
  window.GomokuCompetition=Object.freeze({version:'1.0.0',refresh:()=>refresh(true),openTournament:openCup});
})();
