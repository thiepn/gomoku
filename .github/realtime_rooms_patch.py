from pathlib import Path
import re

p=Path('index.html')
s=p.read_text(encoding='utf-8')
original=s

# Transport constants and state.
old="""  const ROOM_API_BASE='https://hycegznamzjhwinegaai.supabase.co/functions/v1/gomoku-room';
  const ROOM_API_KEY='sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
  let pollTimer=0,roomRequest=false;"""
new="""  const ROOM_PROJECT_URL='https://hycegznamzjhwinegaai.supabase.co';
  const ROOM_API_BASE=ROOM_PROJECT_URL+'/functions/v1/gomoku-room';
  const ROOM_API_KEY='sb_publishable_1rZzRPzfLMaAH5pIgCwIjA_19UPMIsR';
  const ROOM_REALTIME_MODULE='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/+esm';
  let pollTimer=0,roomRequest=false,roomPollBusy=false,realtimeClientPromise=null;"""
if s.count(old)!=1: raise SystemExit(f'room constants block count={s.count(old)}')
s=s.replace(old,new,1)

# Add connection helpers after session persistence.
needle="  function rememberRoom(){try{sessionStorage.setItem('gomoku.room.v4',JSON.stringify(network));}catch{}}\n"
if s.count(needle)!=1: raise SystemExit('rememberRoom hook missing')
helpers=r'''  function rememberRoom(){try{sessionStorage.setItem('gomoku.room.v4',JSON.stringify(network));}catch{}}
  function roomConnectionLabel(){const c=network?.connection;return c==='live'?'Live':c==='connecting'?'Connecting…':c==='reconnecting'?'Reconnecting…':c==='offline'?'Offline':c==='error'?'Connection error':'Fallback sync';}
  function renderRoomConnection(){const el=$('roomConnectionPill');if(!el)return;if(!network){el.hidden=true;el.removeAttribute('data-state');return;}el.hidden=false;el.dataset.state=network.connection||'polling';const dot=el.querySelector('i'),label=el.querySelector('span');if(dot)dot.setAttribute('aria-hidden','true');if(label)label.textContent=roomConnectionLabel();el.title=network.error||'Private room connection';}
  function setRoomConnection(state,error=''){if(!network)return;network.connection=state;if(error!==undefined)network.error=error||'';renderRoomConnection();if($('roomDetails'))renderRoomDetails();rememberRoom();}
  async function roomRealtimeClient(){if(!realtimeClientPromise)realtimeClientPromise=import(ROOM_REALTIME_MODULE).then(mod=>mod.createClient(ROOM_PROJECT_URL,ROOM_API_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})).catch(err=>{realtimeClientPromise=null;throw err;});return realtimeClientPromise;}
'''
s=s.replace(needle,helpers,1)

# Polling remains as heartbeat/fallback instead of the primary sync path.
poll_pattern=re.compile(r"  async function pollRoom\(\)\{[\s\S]*?\n  async function sendRoom\(body\)\{")
m=poll_pattern.search(s)
if not m: raise SystemExit('pollRoom block not found')
poll_new=r'''  async function pollRoom(options={}){clearTimeout(pollTimer);if(!network)return;const session=network;if(roomPollBusy){pollTimer=setTimeout(()=>pollRoom({reason:'coalesced',silent:true}),450);return;}roomPollBusy=true;let fatal=false;try{const state=await roomFetch('/api/rooms/'+session.id);if(network===session){session.error='';applyRoomState(state);if(!roomStream)ensureRoomStream();if(!(roomStream?.kind==='supabase'&&roomStream.status==='SUBSCRIBED'))setRoomConnection('polling','');}}catch(err){if(network===session){session.error=err.message;if(err.status===401||err.status===404){fatal=true;stopRoomStream();setRoomConnection('error',err.message);if($('roomStatus'))$('roomStatus').textContent=err.message+' Leave the room or reconnect with a valid invite.';}else if(navigator.onLine===false){setRoomConnection('offline','No network connection. Your room seat is preserved.');if($('roomStatus'))$('roomStatus').textContent='Offline. Reconnect to continue; your room seat is preserved.';}else{setRoomConnection('reconnecting',err.message);if($('roomStatus'))$('roomStatus').textContent='Reconnecting… '+err.message;}}}finally{roomPollBusy=false;if(network===session&&!fatal){const live=roomStream?.kind==='supabase'&&roomStream.status==='SUBSCRIBED';const delay=navigator.onLine===false?5000:live?15000:1800;pollTimer=setTimeout(()=>pollRoom({reason:'heartbeat',silent:true}),delay);}}}
  async function sendRoom(body){'''
s=poll_pattern.sub(poll_new,s,count=1)

# Realtime cleanup: supports the old transports and the new Supabase channel.
stop_pattern=re.compile(r"function stopRoomStream\(\)\{[\s\S]*?\nfunction startSSE\(")
if not stop_pattern.search(s): raise SystemExit('stopRoomStream/startSSE boundary not found')
stop_new=r'''function stopRoomStream(){const stream=roomStream;roomStream=null;if(!stream)return;try{stream.abort?.abort();}catch{}try{stream.ws?.close();}catch{}try{stream.channel?.unsubscribe?.();}catch{}try{stream.client?.removeChannel?.(stream.channel);}catch{}}
function startSSE('''
s=stop_pattern.sub(stop_new,s,count=1)

# Replace legacy websocket/SSE routing with Supabase Broadcast. Only revision notifications are public;
# actual room state is still fetched with the private room token.
stream_pattern=re.compile(r"function ensureRoomStream\(\)\{[\s\S]*?\nfunction networkOpeningMove\(i\)")
if not stream_pattern.search(s): raise SystemExit('ensureRoomStream boundary not found')
stream_new=r'''async function ensureRoomStream(){const n=network;if(!n||navigator.onLine===false)return;if(roomStream?.session===n&&(roomStream.status==='SUBSCRIBED'||roomStream.status==='connecting'))return;stopRoomStream();const stream={kind:'supabase',session:n,status:'connecting',client:null,channel:null};roomStream=stream;setRoomConnection('connecting','');try{const client=await roomRealtimeClient();if(network!==n||roomStream!==stream)return;const channel=client.channel('gomoku:'+n.id,{config:{broadcast:{self:false},private:false}});stream.client=client;stream.channel=channel;channel.on('broadcast',{event:'changed'},payload=>{if(network!==n||roomStream!==stream)return;const revision=Number(payload?.payload?.revision);n.lastRealtimeAt=Date.now();if(Number.isFinite(revision)&&revision<=Number(n.revision))return;pollRoom({reason:'push',silent:true});});channel.subscribe(status=>{if(network!==n||roomStream!==stream)return;stream.status=status;if(status==='SUBSCRIBED'){n.wsFailures=0;setRoomConnection('live','');clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'heartbeat',silent:true}),15000);return;}if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Live updates interrupted; reconnecting.');clearTimeout(pollTimer);pollTimer=setTimeout(()=>{if(network===n){stopRoomStream();pollRoom({reason:'reconnect'});}},1200);}});}catch(err){if(network!==n)return;stopRoomStream();setRoomConnection(navigator.onLine===false?'offline':'polling',navigator.onLine===false?'No network connection.':'Realtime unavailable; using fallback sync.');clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'fallback'}),800);}}
function networkOpeningMove(i)'''
s=stream_pattern.sub(stream_new,s,count=1)

# Room dialog reports real connection status instead of hard-coded polling.
old_sync="host.append(text('p','Sync: private room · polling'+(network.error?' · '+network.error:''),'tiny'));"
new_sync="host.append(text('p','Sync: '+roomConnectionLabel()+(network.error?' · '+network.error:''),'tiny'));"
if s.count(old_sync)!=1: raise SystemExit('room details sync label missing')
s=s.replace(old_sync,new_sync,1)

# Add persistent board-level connection indicator.
old_insert="insert('panel-play','<section class=\"platform-launch\"><h2 class=\"eyebrow\">PRIVATE ONLINE</h2><p class=\"tiny\">Create or join an invite-only two-player room. No public matchmaking.</p><button class=\"btn ghost wide\" id=\"platformBtn\">Open private room</button></section>');document.querySelector('.board-top').insertAdjacentHTML('beforebegin','<section id=\"networkOpening\" class=\"platform-card\" hidden></section>');$('platformBtn').onclick=openOnline;"
new_insert="insert('panel-play','<section class=\"platform-launch\"><h2 class=\"eyebrow\">PRIVATE ONLINE</h2><p class=\"tiny\">Create or join an invite-only two-player room. No public matchmaking.</p><button class=\"btn ghost wide\" id=\"platformBtn\">Open private room</button></section>');document.querySelector('.board-top').insertAdjacentHTML('beforebegin','<div id=\"roomConnectionPill\" class=\"room-connection-pill\" hidden role=\"status\" aria-live=\"polite\"><i></i><span>Connecting…</span></div><section id=\"networkOpening\" class=\"platform-card\" hidden></section>');$('platformBtn').onclick=openOnline;"
if s.count(old_insert)!=1: raise SystemExit('network insertion hook missing')
s=s.replace(old_insert,new_insert,1)

# Leaving a room clears visible connection state.
old_leave="function leaveRoom(){const study=dataForTree(ensureTree());stopRoomStream();clearTimeout(pollTimer);network=null;try{sessionStorage.removeItem('gomoku.room.v4');}catch{}$('onlineBtn').textContent='Online room';applyData(study,{queue:false});renderNetworkOpening();$('clockToggle').disabled=false;toast('Disconnected from the room. The board is now a local study.');}"
new_leave="function leaveRoom(){const study=dataForTree(ensureTree());stopRoomStream();clearTimeout(pollTimer);network=null;renderRoomConnection();try{sessionStorage.removeItem('gomoku.room.v4');}catch{}$('onlineBtn').textContent='Online room';applyData(study,{queue:false});renderNetworkOpening();$('clockToggle').disabled=false;toast('Disconnected from the room. The board is now a local study.');}"
if s.count(old_leave)!=1: raise SystemExit('leaveRoom hook missing')
s=s.replace(old_leave,new_leave,1)

# Create/join/reconnect start in a clear connection state.
s=s.replace("network={base:ROOM_API_BASE,id:res.id,token:res.token,revision:-1,color:res.color,role:'player'};applyRoomState(res.state);", "network={base:ROOM_API_BASE,id:res.id,token:res.token,revision:-1,color:res.color,role:'player',connection:'connecting',error:''};applyRoomState(res.state);",1)
s=s.replace("network={...n,base:ROOM_API_BASE};pollRoom();", "network={...n,base:ROOM_API_BASE,connection:'reconnecting',error:''};renderRoomConnection();pollRoom({reason:'resume'});",1)

# Foreground/network lifecycle: recover immediately instead of waiting for the next heartbeat.
old_life="networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);window.addEventListener('pagehide',()=>{stopRoomStream();clearTimeout(queuePoll);clearInterval(networkClockTimer);});window.addEventListener('pageshow',()=>{clearInterval(networkClockTimer);networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);if(network)pollRoom();if(queueTicket)pollQueue();});"
new_life="networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);window.addEventListener('pagehide',()=>{stopRoomStream();clearTimeout(queuePoll);clearInterval(networkClockTimer);});window.addEventListener('pageshow',()=>{clearInterval(networkClockTimer);networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);if(network){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Restoring live room connection.');pollRoom({reason:'pageshow'});}if(queueTicket)pollQueue();});document.addEventListener('visibilitychange',()=>{if(network&&document.visibilityState==='visible'){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Refreshing room after backgrounding.');pollRoom({reason:'visible'});}});window.addEventListener('online',()=>{if(network){setRoomConnection('reconnecting','Network restored. Reconnecting…');stopRoomStream();pollRoom({reason:'online'});}});window.addEventListener('offline',()=>{if(network){stopRoomStream();clearTimeout(pollTimer);setRoomConnection('offline','No network connection. Your room seat is preserved.');}});"
if s.count(old_life)!=1: raise SystemExit('network lifecycle hook missing')
s=s.replace(old_life,new_life,1)

# Styling for the always-visible connection state.
style=r'''
<style id="private-room-realtime-style">
.room-connection-pill{display:flex;align-items:center;gap:7px;width:max-content;max-width:100%;min-height:30px;margin:0 2px 8px;padding:5px 9px;border:1px solid var(--hair);border-radius:999px;background:color-mix(in srgb,var(--card) 85%,transparent);color:var(--ink2);font:650 9px/1.2 system-ui;letter-spacing:.02em}
.room-connection-pill i{width:7px;height:7px;border-radius:50%;background:#8b8274;box-shadow:0 0 0 3px #8b827418;flex:none}.room-connection-pill[data-state="live"] i{background:#2f7c55;box-shadow:0 0 0 3px #2f7c5518}.room-connection-pill[data-state="connecting"] i,.room-connection-pill[data-state="reconnecting"] i{background:#b87922;box-shadow:0 0 0 3px #b8792218}.room-connection-pill[data-state="offline"] i,.room-connection-pill[data-state="error"] i{background:var(--seal);box-shadow:0 0 0 3px color-mix(in srgb,var(--seal) 16%,transparent)}
@media(max-width:760px){body[data-v92-route="play"] .room-connection-pill{margin:0 8px 7px;min-height:28px;padding:4px 8px;font-size:8px}}
</style>
'''
if '</body>' not in s: raise SystemExit('body close missing')
s=s.replace('</body>',style+'\n</body>',1)

# Sanity checks.
checks=['ROOM_REALTIME_MODULE','roomRealtimeClient','gomoku:'+"'+'"+'n.id','SUBSCRIBED','roomConnectionPill','visibilitychange','Network restored. Reconnecting','Sync: '+"'+roomConnectionLabel()"]
for chk in checks:
    if chk not in s: raise SystemExit('missing '+chk)
if s==original: raise SystemExit('no changes')
p.write_text(s,encoding='utf-8')
print('realtime patch applied',len(original),'->',len(s))
