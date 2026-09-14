from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')
original = s

API_BASE = 'https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room'
API_KEY = 'sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR'

# 1) Built-in backend configuration and room transport.
old = "  // Online room client. A separately hosted authoritative server is required.\n  let pollTimer=0,roomRequest=false;"
new = f"  // Built-in invite-only private-room client. The server is authoritative for turns and move legality.\n  const ROOM_API_BASE='{API_BASE}';\n  const ROOM_API_KEY='{API_KEY}';\n  let pollTimer=0,roomRequest=false;"
if s.count(old) != 1:
    raise SystemExit(f'Expected one online-room client header, found {s.count(old)}')
s = s.replace(old, new, 1)

room_fetch = re.compile(r"  async function roomFetch\(path,body\)\{[\s\S]*?\n  function rememberRoom\(\)\{")
m = room_fetch.search(s)
if not m:
    raise SystemExit('roomFetch block not found')
replacement = """  async function roomFetch(path,body){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const res=await fetch(endpoint()+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','apikey':ROOM_API_KEY,...(network?.token?{'Authorization':'Bearer '+network.token}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store'});let data;try{data=await res.json();}catch{throw Object.assign(Error('Private-room server returned an invalid response.'),{status:res.status});}if(!res.ok)throw Object.assign(Error(data.error||'Room request failed.'),{status:res.status});return data;}finally{clearTimeout(timer);}}
  function rememberRoom(){"""
s = room_fetch.sub(replacement, s, count=1)

# 2) Polling is the deliberate transport for this lightweight private-room service.
needle = "function ensureRoomStream(){const n=network;if(!n||roomStream?.session===n)return;stopRoomStream();const supportsWS="
if s.count(needle) != 1:
    raise SystemExit(f'Expected one ensureRoomStream entry, found {s.count(needle)}')
s = s.replace(needle, "function ensureRoomStream(){const n=network;if(!n||roomStream?.session===n)return;stopRoomStream();if(String(n.state?.realtime||'polling')==='polling')return;const supportsWS=", 1)

# 3) Waiting-room status before player two arrives.
old_status = "$('statusText').textContent=(S.result?'Room finished':network.role==='spectator'?'Spectating':currentColor()===network.color?'Your move':'Opponent’s move')+' · '+network.id;"
new_status = "$('statusText').textContent=(network.state?.players?.length<2?'Waiting for opponent':S.result?'Room finished':currentColor()===network.color?'Your move':'Opponent’s move')+' · '+network.id;"
if s.count(old_status) != 1:
    raise SystemExit(f'Expected one network status expression, found {s.count(old_status)}')
s = s.replace(old_status, new_status, 1)

# 4) Room details: invite sharing, two-player-only controls, chat.
render_pattern = re.compile(r"  function renderRoomDetails\(\)\{[\s\S]*?\n  function openOnline\(\)\{")
if not render_pattern.search(s):
    raise SystemExit('renderRoomDetails/openOnline boundary not found')
new_render = r'''  function roomInviteUrl(id){const u=new URL(location.href);u.searchParams.set('room',id);u.hash='';return u.href;}
  async function copyRoomText(value,label){try{await navigator.clipboard.writeText(value);toast(label+' copied.');}catch{window.prompt('Copy '+label.toLowerCase(),value);}}
  function renderRoomDetails(){if(!$('roomDetails')||!network)return;const st=network.state,host=$('roomDetails'),oldInput=host.querySelector('input[aria-label="Room message"]'),draft=oldInput?.value||'',hadFocus=document.activeElement===oldInput,start=oldInput?.selectionStart,end=oldInput?.selectionEnd;host.replaceChildren();host.append(text('p','Room '+network.id+' · '+(network.color?name(network.color):'Player'),'opening-status'));if(!st)return;const ready=(st.players||[]).length>=2;host.append(text('p',ready?st.players.map(p=>p.name+' · '+name(p.color)).join(' / '):'Waiting for another player to join.','tiny'));host.append(text('p','Invite code: '+network.id,'tiny'));const share=document.createElement('div');share.className='button-row';share.append(button('Copy room code',()=>copyRoomText(network.id,'Room code')),button('Copy invite link',()=>copyRoomText(roomInviteUrl(network.id),'Invite link')));host.append(share);host.append(text('p','Sync: private room · polling'+(network.error?' · '+network.error:''),'tiny'));
    const actions=document.createElement('div');actions.className='button-row';if(ready){actions.append(button('Offer draw',()=>sendRoom({action:'offer_draw'})),button('Accept draw',()=>sendRoom({action:'accept_draw'})));if(st.game?.result||st.game?.terminal)actions.append(button('Request rematch',()=>sendRoom({action:'rematch'})));}actions.append(button('Leave room',leaveRoom));host.append(actions);if(st.drawOffer)host.append(text('p',name(st.drawOffer)+' offers a draw.','tiny'));if(st.rematch?.length)host.append(text('p','Rematch requested · both players must agree.','tiny'));
    if(ready){const chat=document.createElement('div');chat.className='lab-scroll';for(const m of(st.chat||[]).slice(-30))chat.append(text('p',m.name+': '+m.text,'tiny'));host.append(chat);const input=document.createElement('input');input.maxLength=300;input.placeholder='Room message';input.setAttribute('aria-label','Room message');input.value=draft;host.append(input,button('Send',()=>{const value=input.value.trim();if(value)sendRoom({action:'chat',text:value});input.value='';}));if(hadFocus){input.focus({preventScroll:true});try{input.setSelectionRange(start,end);}catch{}}}}
  function openOnline(){'''
s = render_pattern.sub(new_render, s, count=1)

# 5) Replace the self-hosted/matchmaking dialog with built-in invite-only rooms.
open_pattern = re.compile(r"  function openOnline\(\)\{[\s\S]*?\n  \$\('onlineBtn'\)\.onclick=openOnline;")
if not open_pattern.search(s):
    raise SystemExit('openOnline block not found')
new_open = r'''  function openOnline(){const invite=(new URL(location.href)).searchParams.get('room')?.trim().toUpperCase()||'';openDesk('Private online room',`<p class="muted">Create an invite-only room or join a friend with an eight-character code. There is no public queue or matchmaking.</p><div class="field-row"><label>Nickname<input id="roomNickname" maxlength="24" value="Player" autocomplete="nickname"></label><label>Optional room password<input id="roomPassword" type="password" maxlength="80" autocomplete="off"></label></div><div class="field-row"><label>Room code<input id="roomCode" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false"></label><label>Rules<select id="roomRule"><option value="renju-practice">Renju · Black forbidden moves</option><option value="exact-five">Gomoku · exact five</option><option value="freestyle">Gomoku · freestyle</option></select></label></div><p class="tiny">Free opening only—no opening or swap protocol. The host is Black in game one; an agreed rematch swaps colors. Rooms expire after 24 hours of inactivity. The server validates every move, including Renju forbidden moves.</p><div class="button-row"><button class="btn" id="createRoom">Create room</button><button class="btn ghost" id="joinRoom">Join room</button><button class="btn ghost" id="resumeRoom">Reconnect saved session</button></div><p id="roomStatus" role="status"></p><div id="roomDetails"></div>`);$('roomCode').value=network?.id||(/^[A-Z2-9]{8}$/.test(invite)?invite:'');$('roomRule').value=S.variant;
    async function connect(create){try{if(network)throw Error('Leave the current room before creating or joining another.');if(S.records.length&&!await archiveGame(true))throw Error('Export or save this game before connecting.');const id=$('roomCode').value.trim().toUpperCase(),name=$('roomNickname').value.trim()||'Player';if(!create&&!/^[A-Z2-9]{8}$/.test(id))throw Error('Enter the eight-character room code.');cancelSearch();cancelJobs();stopRoomStream();network={base:ROOM_API_BASE,revision:-1};const payload=create?{name,password:$('roomPassword').value,rule:$('roomRule').value}:{name,password:$('roomPassword').value};const res=await roomFetch(create?'/api/rooms':'/api/rooms/'+id+'/join',payload);network={base:ROOM_API_BASE,id:res.id,token:res.token,revision:-1,color:res.color,role:'player'};applyRoomState(res.state);rememberRoom();pollRoom();if(create){$('roomCode').value=res.id;toast('Room '+res.id+' created. Share the invite link.');}else toast('Joined room '+res.id+'.');}catch(err){if(network&&!network.id)network=null;safeError(err);}}
    $('createRoom').onclick=()=>connect(true);$('joinRoom').onclick=()=>connect(false);$('resumeRoom').onclick=()=>{try{const n=JSON.parse(sessionStorage.getItem('gomoku.room.v4'));if(!n?.token||!n?.id)throw Error('No saved private-room session in this tab.');if(n.base&&n.base!==ROOM_API_BASE)throw Error('The saved session belongs to the retired external-server room system.');network={...n,base:ROOM_API_BASE};pollRoom();}catch(err){safeError(err);}};renderRoomDetails();}
  $('onlineBtn').onclick=openOnline;
  queueMicrotask(()=>{const invite=(new URL(location.href)).searchParams.get('room')?.trim().toUpperCase();if(/^[A-Z2-9]{8}$/.test(invite||'')&&!network)setTimeout(()=>{if(!$('workbenchDialog').open)openOnline();},350);});'''
s = open_pattern.sub(new_open, s, count=1)

# 6) Remove the public matchmaking surface and point the play-panel launcher to private rooms.
old_launch = "insert('panel-play','<section class=\"platform-launch\"><h2 class=\"eyebrow\">ONLINE COMPETITION</h2><p class=\"tiny\">Private rooms or matching opponents on your own server. Local play remains account-free.</p><button class=\"btn ghost wide\" id=\"platformBtn\">Matchmaking &amp; account</button></section>');"
new_launch = "insert('panel-play','<section class=\"platform-launch\"><h2 class=\"eyebrow\">PRIVATE ONLINE</h2><p class=\"tiny\">Create or join an invite-only two-player room. No public matchmaking.</p><button class=\"btn ghost wide\" id=\"platformBtn\">Open private room</button></section>');"
if s.count(old_launch) != 1:
    raise SystemExit(f'Expected one online competition launcher, found {s.count(old_launch)}')
s = s.replace(old_launch, new_launch, 1)
if s.count("$('platformBtn').onclick=openPlatform;") != 1:
    raise SystemExit('Expected one platformBtn openPlatform binding')
s = s.replace("$('platformBtn').onclick=openPlatform;", "$('platformBtn').onclick=openOnline;", 1)

old_tip = "onlineBtn:'Connect to a configured external room server.'"
if s.count(old_tip) != 1:
    raise SystemExit(f'Expected one online tooltip, found {s.count(old_tip)}')
s = s.replace(old_tip, "onlineBtn:'Create or join an invite-only online room.'", 1)

# 7) Keep the public-facing language aligned with the product scope.
s = s.replace('Online room', 'Private room', 1)  # header button only

# Assertions: no retired setup UI on the active private-room path.
for obsolete in [
    'Use the included self-hosted room server for link-based play without accounts.',
    '<label>Server URL<input id="roomBase"',
    '<option value="spectator">Spectator</option>',
    '<option value="swap2">Swap2 · freestyle</option>',
    'Matchmaking &amp; account</button></section>',
]:
    if obsolete in s:
        raise SystemExit(f'Obsolete private-room UI remains: {obsolete}')
if f"const ROOM_API_BASE='{API_BASE}'" not in s or f"const ROOM_API_KEY='{API_KEY}'" not in s:
    raise SystemExit('Built-in private-room endpoint configuration missing')
if "if(String(n.state?.realtime||'polling')==='polling')return;" not in s:
    raise SystemExit('Polling transport guard missing')
if "Free opening only—no opening or swap protocol." not in s:
    raise SystemExit('Private-room free-opening copy missing')
if "$('platformBtn').onclick=openOnline;" not in s:
    raise SystemExit('Play-panel private-room launcher is not wired')
if s == original:
    raise SystemExit('Patch produced no changes')

path.write_text(s, encoding='utf-8')
print('Private-room frontend patch applied:', len(original), '->', len(s), 'bytes')
