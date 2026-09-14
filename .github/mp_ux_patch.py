from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
original=s
marker='multiplayer-ux-polish-v12'
if marker in s:
    raise SystemExit('multiplayer UX layer already present')

# Let connection-state changes also refresh the dedicated multiplayer HUD.
old_set="  function setRoomConnection(state,error=''){if(!network)return;network.connection=state;if(error!==undefined)network.error=error||'';renderRoomConnection();if($('roomDetails'))renderRoomDetails();rememberRoom();}"
new_set="  function setRoomConnection(state,error=''){if(!network)return;network.connection=state;if(error!==undefined)network.error=error||'';renderRoomConnection();if($('roomDetails'))renderRoomDetails();renderRoomMultiplayerUX();rememberRoom();}"
if s.count(old_set)!=1: raise SystemExit('setRoomConnection hook missing')
s=s.replace(old_set,new_set,1)

# Add multiplayer UX helpers immediately after the Realtime client factory.
needle="  async function roomRealtimeClient(){if(!realtimeClientPromise)realtimeClientPromise=import(ROOM_REALTIME_MODULE).then(mod=>mod.createClient(ROOM_PROJECT_URL,ROOM_API_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})).catch(err=>{realtimeClientPromise=null;throw err;});return realtimeClientPromise;}\n"
if s.count(needle)!=1: raise SystemExit('roomRealtimeClient hook missing')
helpers=r'''  async function roomRealtimeClient(){if(!realtimeClientPromise)realtimeClientPromise=import(ROOM_REALTIME_MODULE).then(mod=>mod.createClient(ROOM_PROJECT_URL,ROOM_API_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})).catch(err=>{realtimeClientPromise=null;throw err;});return realtimeClientPromise;}
  function roomPlayerPair(){const st=network?.state,players=Array.isArray(st?.players)?st.players:[],seat=Number(st?.you?.seat)||0,color=Number(network?.color)||0;const you=players.find(p=>Number(p.seat)===seat)||players.find(p=>Number(p.color)===color)||null;const opponent=players.find(p=>you?Number(p.seat)!==Number(you.seat):Number(p.color)!==color)||null;return {you,opponent};}
  function roomRuleLabel(rule){return rule==='renju-practice'?'Renju':rule==='exact-five'?'Exact Five':'Freestyle';}
  function roomPresenceLabel(){if(!network)return '';const {opponent}=roomPlayerPair();if(!opponent)return 'Waiting';if(network.connection!=='live'&&!network.presenceReady)return 'Status unknown';if(!network.presenceReady)return 'Checking…';return network.opponentOnline?'Online':'Reconnecting';}
  function roomStoneClass(color){return Number(color)===2?'white':'black';}
  async function shareRoomInvite(){if(!network?.id)return;const url=roomInviteUrl(network.id);if(navigator.share){try{await navigator.share({title:'Gomoku room '+network.id,text:'Join my private Gomoku room '+network.id,url});return;}catch(err){if(err?.name==='AbortError')return;}}await copyRoomText(url,'Invite link');}
  function ensureRoomUxMounted(){if($('roomMatchHud'))return;const anchor=$('networkOpening')||document.querySelector('.board-top');if(!anchor)return;const hud=document.createElement('section');hud.id='roomMatchHud';hud.className='room-match-hud';hud.hidden=true;hud.innerHTML='<div class="room-hud-main"><div class="room-hud-player room-hud-you"><span class="room-hud-stone" id="roomYouStone"></span><div><small>YOU</small><b id="roomYouName">You</b><span id="roomYouColor"></span></div></div><div class="room-hud-turn"><b id="roomTurnState">Waiting</b><span id="roomRoundState"></span></div><div class="room-hud-player room-hud-opponent"><div><small>OPPONENT</small><b id="roomOpponentName">Waiting…</b><span class="room-presence" id="roomOpponentPresence"><i></i><em>Waiting</em></span></div><span class="room-hud-stone" id="roomOpponentStone"></span></div></div><div class="room-hud-actions"><button class="btn ghost" id="roomHudChat">Chat</button><button class="btn ghost" id="roomHudShare">Share invite</button></div><div class="room-waiting-panel" id="roomWaitingPanel" hidden><div><small>PRIVATE ROOM</small><b id="roomWaitingTitle">Waiting for opponent</b><span id="roomWaitingCode"></span></div><button class="btn" id="roomWaitingShare">Share invite</button></div>';
    anchor.insertAdjacentElement('beforebegin',hud);
    $('roomHudChat').onclick=openRoomChat;$('roomHudShare').onclick=shareRoomInvite;$('roomWaitingShare').onclick=shareRoomInvite;
    const d=document.createElement('dialog');d.id='roomChatSheet';d.setAttribute('aria-labelledby','roomChatTitle');d.innerHTML='<div class="room-chat-shell"><header><div><small>PRIVATE ROOM CHAT</small><h2 id="roomChatTitle">Room chat</h2></div><button class="room-chat-close" id="roomChatClose" aria-label="Close chat">×</button></header><div class="room-chat-messages" id="roomChatMessages" aria-live="polite"></div><form id="roomChatForm"><input id="roomChatInput" maxlength="300" autocomplete="off" placeholder="Message your opponent" aria-label="Room message"><button class="btn" type="submit">Send</button></form></div>';document.body.append(d);$('roomChatClose').onclick=()=>d.close();d.addEventListener('close',()=>{if(network){network.chatSeen=network.state?.chat?.length||0;renderRoomMultiplayerUX();}});$('roomChatForm').onsubmit=e=>{e.preventDefault();const input=$('roomChatInput'),value=input.value.trim();if(!value||!network)return;sendRoom({action:'chat',text:value});input.value='';};}
  function renderRoomChat(){ensureRoomUxMounted();const d=$('roomChatSheet'),host=$('roomChatMessages');if(!d||!host)return;host.replaceChildren();if(!network){if(d.open)d.close();return;}const st=network.state,messages=(st?.chat||[]).slice(-40),{you}=roomPlayerPair();for(const m of messages){const row=document.createElement('div');row.className='room-chat-message'+(you&&m.name===you.name?' own':'');const meta=document.createElement('span');meta.textContent=m.name||'Player';const body=document.createElement('p');body.textContent=m.text||'';row.append(meta,body);host.append(row);}if(d.open){network.chatSeen=st?.chat?.length||0;requestAnimationFrame(()=>{host.scrollTop=host.scrollHeight;});}}
  function openRoomChat(){if(!network)return;ensureRoomUxMounted();renderRoomChat();network.chatSeen=network.state?.chat?.length||0;const d=$('roomChatSheet');if(d&&!d.open)d.showModal();requestAnimationFrame(()=>$('roomChatInput')?.focus());renderRoomMultiplayerUX();}
  function maybeRoomTurnHaptic(previous,state){if(!previous||!state||previous.round!==state.round||state.game?.result||!network?.color)return;const before=previous.game?.moves?.length||0,after=state.game?.moves?.length||0;if(after<=before)return;const beforeTurn=before%2?2:1,afterTurn=after%2?2:1;if(beforeTurn!==network.color&&afterTurn===network.color&&document.visibilityState==='visible'){try{navigator.vibrate?.(32);}catch{}}}
  function renderRoomMultiplayerUX(previous=null){ensureRoomUxMounted();const hud=$('roomMatchHud');if(!hud)return;if(!network){hud.hidden=true;const d=$('roomChatSheet');if(d?.open)d.close();return;}hud.hidden=false;const st=network.state||{},pair=roomPlayerPair(),ready=!!pair.opponent,youColor=Number(network.color)||Number(pair.you?.color)||1,oppColor=Number(pair.opponent?.color)||(youColor===1?2:1),finished=!!(st.game?.result||st.game?.terminal),yourTurn=ready&&!finished&&currentColor()===youColor;
    $('roomYouName').textContent=pair.you?.name||'You';$('roomYouColor').textContent=name(youColor);$('roomYouStone').className='room-hud-stone '+roomStoneClass(youColor);$('roomOpponentName').textContent=pair.opponent?.name||'Waiting…';$('roomOpponentStone').className='room-hud-stone '+roomStoneClass(oppColor);$('roomOpponentStone').hidden=!ready;
    const presence=roomPresenceLabel(),presenceHost=$('roomOpponentPresence');presenceHost.querySelector('em').textContent=presence;presenceHost.dataset.state=network.opponentOnline?'online':ready&&network.presenceReady?'away':'unknown';
    $('roomTurnState').textContent=!ready?'Waiting for opponent':finished?'Game finished':yourTurn?'Your turn':'Opponent’s turn';$('roomTurnState').dataset.turn=yourTurn?'you':ready&&!finished?'opponent':'neutral';$('roomRoundState').textContent='Round '+(st.round||1)+' · '+roomRuleLabel(st.rule||S.variant)+' · '+network.id;
    const wait=$('roomWaitingPanel');wait.hidden=ready;$('roomWaitingCode').textContent='Code '+network.id+' · '+name(youColor);$('roomHudChat').disabled=!ready;
    const chat=(st.chat||[]),seen=Number(network.chatSeen)||0,{you}=pair,last=chat.at?.(-1)||chat[chat.length-1],unread=!$('roomChatSheet')?.open&&chat.length>seen&&(!you||last?.name!==you.name);$('roomHudChat').textContent=unread?'Chat · New':'Chat';renderRoomChat();if(previous)maybeRoomTurnHaptic(previous,st);}
'''
s=s.replace(needle,helpers,1)

# Capture the previous authoritative room state and refresh the new multiplayer UX after state application.
prefix="  function applyRoomState(state){if(!network||state.id!==network.id||state.revision<network.revision)return;network.revision=state.revision;"
replacement="  function applyRoomState(state){if(!network||state.id!==network.id||state.revision<network.revision)return;const previousRoomState=network.state;network.revision=state.revision;"
if s.count(prefix)!=1: raise SystemExit('applyRoomState prefix missing')
s=s.replace(prefix,replacement,1)
old_tail="rememberRoom();render();renderRoomDetails();renderNetworkOpening();renderNetworkClock();ensureRoomStream();}"
new_tail="rememberRoom();render();renderRoomDetails();renderNetworkOpening();renderNetworkClock();ensureRoomStream();renderRoomMultiplayerUX(previousRoomState);}"
if s.count(old_tail)!=1: raise SystemExit('applyRoomState tail missing')
s=s.replace(old_tail,new_tail,1)

# Presence is advisory UX only. Game state still comes through the authenticated room API.
channel_old="const channel=client.channel('gomoku:'+n.id,{config:{broadcast:{self:false},private:false}});"
channel_new="n.presenceKey=n.presenceKey||(typeof crypto?.randomUUID==='function'?crypto.randomUUID():uid()+'_'+Date.now());const channel=client.channel('gomoku:'+n.id,{config:{broadcast:{self:false},presence:{key:n.presenceKey},private:false}});"
if s.count(channel_old)!=1: raise SystemExit('realtime channel config missing')
s=s.replace(channel_old,channel_new,1)

presence_hook="});channel.subscribe(status=>{if(network!==n||roomStream!==stream)return;stream.status=status;"
presence_new="});channel.on('presence',{event:'sync'},()=>{if(network!==n||roomStream!==stream)return;const ownSeat=Number(n.state?.you?.seat)||0,state=channel.presenceState(),all=Object.values(state||{}).flat();n.presenceReady=true;n.opponentOnline=all.some(p=>Number(p?.seat)&&Number(p.seat)!==ownSeat);renderRoomMultiplayerUX();});channel.subscribe(async status=>{if(network!==n||roomStream!==stream)return;stream.status=status;"
if s.count(presence_hook)!=1: raise SystemExit('channel subscribe hook missing')
s=s.replace(presence_hook,presence_new,1)

sub_old="if(status==='SUBSCRIBED'){n.wsFailures=0;setRoomConnection('live','');clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'heartbeat',silent:true}),15000);return;}"
sub_new="if(status==='SUBSCRIBED'){n.wsFailures=0;n.presenceReady=false;n.opponentOnline=false;setRoomConnection('live','');try{await channel.track({seat:Number(n.state?.you?.seat)||0,color:Number(n.color)||0});}catch{}clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'heartbeat',silent:true}),15000);return;}"
if s.count(sub_old)!=1: raise SystemExit('SUBSCRIBED block missing')
s=s.replace(sub_old,sub_new,1)

# Leaving must hide the HUD/chat immediately.
leave_old="network=null;renderRoomConnection();try{sessionStorage.removeItem('gomoku.room.v4');}catch{}"
leave_new="network=null;renderRoomConnection();renderRoomMultiplayerUX();try{sessionStorage.removeItem('gomoku.room.v4');}catch{}"
if s.count(leave_old)!=1: raise SystemExit('leaveRoom UX hook missing')
s=s.replace(leave_old,leave_new,1)

css=r'''
<style id="multiplayer-ux-polish-v12">
body:not([data-v92-route="play"]) #roomMatchHud{display:none!important}
.room-match-hud{margin:0 2px 10px;padding:10px;border:1px solid var(--hair);border-radius:10px;background:color-mix(in srgb,var(--card) 86%,transparent);box-shadow:0 4px 14px #3426140a}
.room-hud-main{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:12px;align-items:center}.room-hud-player{display:flex;gap:9px;align-items:center;min-width:0}.room-hud-player>div{min-width:0}.room-hud-player small,.room-waiting-panel small,.room-chat-shell header small{display:block;font-size:7px;letter-spacing:.15em;color:var(--ink2);font-weight:800}.room-hud-player b{display:block;margin-top:2px;font:600 13px Georgia;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.room-hud-player>div>span:not(.room-presence){display:block;margin-top:2px;color:var(--ink2);font-size:8px}.room-hud-opponent{justify-content:flex-end;text-align:right}.room-hud-stone{width:22px;height:22px;border-radius:50%;flex:none;box-shadow:0 2px 4px #24190e42}.room-hud-stone.black{background:radial-gradient(circle at 32% 28%,#666,#171614 66%,#050505)}.room-hud-stone.white{background:radial-gradient(circle at 32% 28%,#fff,#e9e1d2 66%);border:1px solid #9e927c66}.room-hud-turn{text-align:center;min-width:116px}.room-hud-turn b{display:block;font:600 14px Georgia}.room-hud-turn b[data-turn="you"]{color:var(--seal)}.room-hud-turn span{display:block;margin-top:3px;font-size:7px;color:var(--ink2);white-space:nowrap}.room-presence{display:inline-flex!important;justify-content:flex-end;align-items:center;gap:4px;margin-top:4px;font-size:8px;color:var(--ink2)}.room-presence i{width:6px;height:6px;border-radius:50%;background:#9a9184}.room-presence em{font-style:normal}.room-presence[data-state="online"] i{background:#2f7c55;box-shadow:0 0 0 2px #2f7c5518}.room-presence[data-state="away"] i{background:#b87922}.room-hud-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--hair)}.room-hud-actions .btn{min-height:34px;padding:6px 10px;font-size:9px}.room-waiting-panel{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:11px;border-radius:8px;background:var(--soft);border:1px solid color-mix(in srgb,var(--seal) 20%,var(--hair))}.room-waiting-panel b{display:block;margin-top:3px;font:600 15px Georgia}.room-waiting-panel span{display:block;margin-top:4px;color:var(--ink2);font-size:9px}.room-waiting-panel .btn{min-height:40px}
#roomChatSheet{width:min(520px,calc(100vw - 24px));max-height:min(76dvh,680px);padding:0;border:1px solid var(--hair2);border-radius:14px;background:var(--paper);color:var(--ink);box-shadow:0 26px 90px #1b140d38}#roomChatSheet::backdrop{background:#1c160f55;backdrop-filter:blur(2px)}.room-chat-shell{display:grid;grid-template-rows:auto minmax(140px,1fr) auto;max-height:min(76dvh,680px)}.room-chat-shell header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px;border-bottom:1px solid var(--hair)}.room-chat-shell h2{margin-top:3px;font-size:22px}.room-chat-close{width:42px;height:42px;border:1px solid var(--hair);border-radius:8px;background:transparent;color:var(--ink);font-size:25px}.room-chat-messages{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:7px;overscroll-behavior:contain}.room-chat-message{align-self:flex-start;max-width:84%;padding:8px 10px;border:1px solid var(--hair);border-radius:10px 10px 10px 3px;background:var(--card2)}.room-chat-message.own{align-self:flex-end;border-radius:10px 10px 3px 10px;background:var(--soft);border-color:color-mix(in srgb,var(--seal) 20%,var(--hair))}.room-chat-message span{display:block;margin-bottom:3px;color:var(--ink2);font-size:7px;font-weight:750}.room-chat-message p{font-size:11px;line-height:1.45;overflow-wrap:anywhere}.room-chat-shell form{display:grid;grid-template-columns:1fr auto;gap:7px;padding:12px;border-top:1px solid var(--hair);background:var(--paper)}.room-chat-shell form input{min-width:0;min-height:46px;border:1px solid var(--hair2);border-radius:8px;background:var(--card2);color:var(--ink);padding:10px 11px;font-size:16px}.room-chat-shell form .btn{min-width:78px}
@media(max-width:760px){body[data-v92-route="play"] .room-match-hud{margin:0 8px 8px;padding:8px;border-radius:9px}.room-hud-main{grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr);gap:7px}.room-hud-player{gap:6px}.room-hud-player b{font-size:12px}.room-hud-stone{width:19px;height:19px}.room-hud-turn{min-width:0}.room-hud-turn b{font-size:12px}.room-hud-turn span{font-size:6px;white-space:normal;line-height:1.25}.room-hud-actions{margin-top:6px;padding-top:6px}.room-hud-actions .btn{min-height:38px;flex:1}.room-waiting-panel{padding:9px}.room-waiting-panel b{font-size:13px}.room-waiting-panel .btn{min-height:42px;padding-inline:10px}#roomChatSheet{margin:auto 0 0;width:100vw;max-width:none;max-height:74dvh;border-width:1px 0 0;border-radius:16px 16px 0 0}.room-chat-shell{max-height:74dvh}.room-chat-shell header{padding:13px 14px}.room-chat-messages{padding:12px 10px}.room-chat-message{max-width:88%}.room-chat-shell form{padding:9px 9px calc(9px + env(safe-area-inset-bottom))}}
@media(max-width:390px){.room-hud-main{grid-template-columns:minmax(0,1fr) 80px minmax(0,1fr)}.room-hud-player small{font-size:6px}.room-hud-player b{font-size:11px}.room-presence{font-size:7px}.room-hud-turn b{font-size:11px}.room-hud-turn span{font-size:5.5px}.room-waiting-panel{align-items:flex-start;flex-direction:column}.room-waiting-panel .btn{width:100%}}
</style>
'''
if '</body>' not in s: raise SystemExit('body close missing')
s=s.replace('</body>',css+'\n</body>',1)

checks=['roomMatchHud','roomChatSheet','roomPresenceLabel','presenceState()','channel.track({seat:','navigator.vibrate','roomWaitingPanel',marker]
for x in checks:
    if x not in s: raise SystemExit('missing '+x)
if s==original: raise SystemExit('no changes')
p.write_text(s,encoding='utf-8')
print('multiplayer UX patch applied',len(original),'->',len(s))
