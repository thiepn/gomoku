from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

start = s.find('/* Optional self-hosted competition. Offline play never touches these endpoints. */')
end = s.find('/* V5.7 opening knowledge', start)
if start < 0 or end <= start:
    raise SystemExit(f'legacy boundaries invalid: {start}, {end}')
old = s[start:end]
if len(old) < 25000:
    raise SystemExit(f'legacy block unexpectedly short: {len(old)}')

slim = r'''/* Private-room transport and lifecycle. Public matchmaking/accounts were removed. */
let roomStream=null,networkClockTimer=0;
function stopRoomStream(){const stream=roomStream;roomStream=null;if(!stream)return;try{stream.abort?.abort();}catch{}try{stream.ws?.close();}catch{}try{stream.channel?.unsubscribe?.();}catch{}try{stream.client?.removeChannel?.(stream.channel);}catch{}}
async function ensureRoomStream(){const n=network;if(!n||navigator.onLine===false)return;if(roomStream?.session===n&&(roomStream.status==='SUBSCRIBED'||roomStream.status==='connecting'))return;stopRoomStream();const stream={kind:'supabase',session:n,status:'connecting',client:null,channel:null};roomStream=stream;setRoomConnection('connecting','');try{const client=await roomRealtimeClient();if(network!==n||roomStream!==stream)return;n.presenceKey=n.presenceKey||(typeof crypto?.randomUUID==='function'?crypto.randomUUID():uid()+'_'+Date.now());const channel=client.channel('gomoku:'+n.id,{config:{broadcast:{self:false},presence:{key:n.presenceKey},private:false}});stream.client=client;stream.channel=channel;channel.on('broadcast',{event:'changed'},payload=>{if(network!==n||roomStream!==stream)return;const revision=Number(payload?.payload?.revision);n.lastRealtimeAt=Date.now();if(Number.isFinite(revision)&&revision<=Number(n.revision))return;pollRoom({reason:'push',silent:true});});channel.on('presence',{event:'sync'},()=>{if(network!==n||roomStream!==stream)return;const ownSeat=Number(n.state?.you?.seat)||0,state=channel.presenceState(),all=Object.values(state||{}).flat();n.presenceReady=true;n.opponentOnline=all.some(p=>Number(p?.seat)&&Number(p.seat)!==ownSeat);renderRoomMultiplayerUX();});channel.subscribe(async status=>{if(network!==n||roomStream!==stream)return;stream.status=status;if(status==='SUBSCRIBED'){n.wsFailures=0;n.presenceReady=false;n.opponentOnline=false;setRoomConnection('live','');try{await channel.track({seat:Number(n.state?.you?.seat)||0,color:Number(n.color)||0});}catch{}clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'heartbeat',silent:true}),15000);return;}if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Live updates interrupted; reconnecting.');clearTimeout(pollTimer);pollTimer=setTimeout(()=>{if(network===n){stopRoomStream();pollRoom({reason:'reconnect'});}},1200);}});}catch(err){if(network!==n)return;stopRoomStream();setRoomConnection(navigator.onLine===false?'offline':'polling',navigator.onLine===false?'No network connection.':'Realtime unavailable; using fallback sync.');clearTimeout(pollTimer);pollTimer=setTimeout(()=>pollRoom({reason:'fallback'}),800);}}
function networkOpeningMove(){return false;}
function renderNetworkOpening(){const host=$('networkOpening');if(!host)return;host.hidden=true;host.replaceChildren();}
function renderNetworkClock(){if(!network?.state?.clock?.enabled)return;const c=network.state.clock,remaining=c.remaining.slice(),elapsed=Math.max(0,performance.now()-(network.receivedAt||performance.now()));if(c.running)remaining[c.side]=Math.max(0,remaining[c.side]-elapsed);$('clockStrip').hidden=false;$('blackClock').textContent=clockString(remaining[1]);$('whiteClock').textContent=clockString(remaining[2]);$('blackClockBox').classList.toggle('active',c.side===1&&c.running);$('whiteClockBox').classList.toggle('active',c.side===2&&c.running);const pause=$('clockToggle');if(pause){pause.disabled=true;pause.textContent='Server clock';}}
insert('panel-play','<section class="platform-launch"><h2 class="eyebrow">PRIVATE ONLINE</h2><p class="tiny">Create or join an invite-only two-player room. No public matchmaking.</p><button class="btn ghost wide" id="platformBtn">Open private room</button></section>');document.querySelector('.board-top').insertAdjacentHTML('beforebegin','<div id="roomConnectionPill" class="room-connection-pill" hidden role="status" aria-live="polite"><i></i><span>Connecting…</span></div><section id="networkOpening" class="platform-card" hidden></section>');$('platformBtn').onclick=openOnline;
networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);window.addEventListener('pagehide',()=>{stopRoomStream();clearInterval(networkClockTimer);});window.addEventListener('pageshow',()=>{clearInterval(networkClockTimer);networkClockTimer=setInterval(()=>{if(network)renderNetworkClock();},250);if(network){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Restoring live room connection.');pollRoom({reason:'pageshow'});}});document.addEventListener('visibilitychange',()=>{if(network&&document.visibilityState==='visible'){setRoomConnection(navigator.onLine===false?'offline':'reconnecting',navigator.onLine===false?'No network connection.':'Refreshing room after backgrounding.');pollRoom({reason:'visible'});}});window.addEventListener('online',()=>{if(network){setRoomConnection('reconnecting','Network restored. Reconnecting…');stopRoomStream();pollRoom({reason:'online'});}});window.addEventListener('offline',()=>{if(network){stopRoomStream();clearTimeout(pollTimer);setRoomConnection('offline','No network connection. Your room seat is preserved.');}});

'''

s = s[:start] + slim + s[end:]
s = s.replace(',openPlatform,', ',')
s = s.replace('syncNow:runAccountSync,', '')
s = s.replace("if(network.role==='spectator'||network.color!==currentColor())", "if(network.color!==currentColor())")

stale = 'Optional accounts and online play require your own hosted server.'
fresh = 'Private online rooms are invite-only. No account or public matchmaking is required.'
if s.count(stale) != 1:
    raise SystemExit(f'stale footer count={s.count(stale)}')
s = s.replace(stale, fresh, 1)

p.write_text(s, encoding='utf-8')
print('removed legacy block bytes', len(old), 'new bytes', len(slim))
