"""P13 reliability, observability & competitive recovery UI embedding.

Run after ui/build.py. Idempotent: replaces its own generated blocks.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/'index.html'
s=INDEX.read_text()

start='/* P8_COMPETITION_BRIDGE_START */'
end='/* P8_COMPETITION_BRIDGE_END */'
bridge=r"""/* P8_COMPETITION_BRIDGE_START */
  window.GomokuCompetitionBridge=Object.freeze({
    publicGet:rankedPublicFetch,
    accountPost:roomAccountApi,
    accountGet:async path=>{const token=roomAccountToken();if(!token)throw Object.assign(Error('Connect THIEPN Account to continue.'),{status:401});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const res=await fetch(ROOM_API_BASE+path,{headers:{apikey:ROOM_API_KEY,'X-Gomoku-Account-Token':token},signal:controller.signal,cache:'no-store'}),data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Administrative request failed.'),{status:res.status,requestId:data.requestId||null});return data;}finally{clearTimeout(timer);}},
    account:()=>({connected:roomAccountState.connected===true,username:roomAccountState.profile?.username||null}),
    detail:async id=>{const token=roomAccountToken();if(!token)return null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const res=await fetch(ROOM_API_BASE+'/api/tournaments/'+encodeURIComponent(id),{headers:{apikey:ROOM_API_KEY,'X-Gomoku-Account-Token':token},signal:controller.signal,cache:'no-store'}),data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Tournament request failed.'),{status:res.status});return data.tournament||null;}finally{clearTimeout(timer);}},
    enterTournament:async data=>{if(!data?.id||!data?.state)return false;if(network&&network.id===data.id)return true;if(network){toast('Leave the current room before opening a tournament match.');return false;}if(S.records.length&&!await archiveGame(true)){toast('Export or save the current game before opening the tournament match.');return false;}await enterRoom({...data,accountBound:true});return true;},
    enterChallenge:async data=>{if(!data?.id||!data?.state)return false;if(network&&network.id===data.id)return true;if(network){toast('Leave the current room before opening the direct challenge.');return false;}if(S.records.length&&!await archiveGame(true)){toast('Export or save the current game before opening the challenge.');return false;}await enterRoom({...data,accountBound:true});return true;},
    spectateTournament:async roomId=>{const id=normalizeRoomCode(roomId);if(!id)throw Error('Tournament room is unavailable.');if(network&&network.id===id)return true;if(network){toast('Leave the current room before watching another match.');return false;}return await connectRoom({id,spectate:true});},
    room:()=>network?{id:network.id,role:network.role,state:network.state||null}:null,
    toast
  });
  /* P8_COMPETITION_BRIDGE_END */
"""
if start in s and end in s:
    s=re.sub(re.escape(start)+r'.*?'+re.escape(end),bridge.strip(),s,count=1,flags=re.S)
else:
    anchor='  function renderRoomAccount(){'
    if s.count(anchor)!=1:raise SystemExit('P8 bridge anchor not unique.')
    s=s.replace(anchor,bridge+'\n\n'+anchor,1)

for tag,ident,filename,folder in [
    ('style','p8-competition-style','p8-competition.css','online'),
    ('script','p8-competition-script','p8-competition.js','online'),
    ('style','p15-operations-style','p15-console.css','operations'),
    ('script','p15-operations-script','p15-console.js','operations')
]:
    content=(ROOT/folder/filename).read_text()
    block=f'<{tag} id="{ident}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{re.escape(ident)}">.*?</{tag}>'
    if re.search(pattern,s,re.S):
        s=re.sub(pattern,lambda _:block,s,count=1,flags=re.S)
    else:
        if s.count('</body>')!=1:raise SystemExit('Expected one closing body tag.')
        s=s.replace('</body>',block+'\n</body>',1)


# Route the existing verified-player profile entrypoint into the richer competitive profile.
profile_start='  async function openPlayerProfile(username){'
profile_end='  function bindRoomProfileName(el,player){'
a=s.find(profile_start)
b=s.find(profile_end,a)
if a<0 or b<0:
    raise SystemExit('Competitive player profile bridge anchors not found.')
fallback=s[a:b]
delegate="if(window.GomokuCompetition?.openPlayerProfile)return window.GomokuCompetition.openPlayerProfile(username);"
if delegate not in fallback:
    delegated=profile_start+delegate+fallback[len(profile_start):]
    s=s[:a]+delegated+s[b:]


# P12 compatibility: retain ranked restrictions and repeat-opponent rating protection.
restricted_marker="if(data.status==='restricted'){stopRankedPolling();"
if restricted_marker not in s:
    queue_anchor="roomRankedState.queue=data;roomRankedState.summary="
    if s.count(queue_anchor)!=1:
        raise SystemExit('P12 ranked queue anchor not unique.')
    restricted="if(data.status==='restricted'){stopRankedPolling();roomRankedState.status='idle';roomRankedState.queue=null;const until=data.restrictedUntil?new Date(data.restrictedUntil).toLocaleString():'';roomRankedState.error=(data.reason==='abandonment_cooldown'?'Ranked cooldown after repeated abandonments':'Ranked access is temporarily restricted')+(until?' · until '+until:'');renderRankedPanel();toast(roomRankedState.error);return;}"
    s=s.replace(queue_anchor,restricted+queue_anchor,1)

protection_marker="Repeat-opponent protection:"
if protection_marker not in s:
    rating_anchor="postText+=' · Rating '+rr.before+' → '+rr.after+' ('+rankedDeltaText(delta)+')';"
    if s.count(rating_anchor)!=1:
        raise SystemExit('P12 ranked result anchor not unique.')
    rating_patch=rating_anchor+"if(rr.protection&&rr.protection.level!=='none')postText+=' · Repeat-opponent protection: '+rr.protection.level+' K '+rr.protection.effectiveKFactor+'/'+rr.protection.baseKFactor;"
    s=s.replace(rating_anchor,rating_patch,1)


# P13: harden room recovery, expose manual reconnect, and show durable result persistence.
retry_marker="function retryRoomConnection(){"
if retry_marker not in s:
    render_anchor="function renderRoomConnection(){"
    if s.count(render_anchor)!=1:
        raise SystemExit('P13 room connection anchor not unique.')
    retry_fn="function retryRoomConnection(){if(!network||navigator.onLine===false)return;network.recoveryFailures=0;stopRoomStream();clearTimeout(pollTimer);setRoomConnection('reconnecting','Retrying now…');pollRoom({reason:'manual-retry'});}\n  "
    s=s.replace(render_anchor,retry_fn+render_anchor,1)

connection_render_old="function renderRoomConnection(){const el=$('roomConnectionPill');if(!el)return;if(!network){el.hidden=true;el.removeAttribute('data-state');return;}el.hidden=false;el.dataset.state=network.connection||'polling';const dot=el.querySelector('i'),label=el.querySelector('span');if(dot)dot.setAttribute('aria-hidden','true');if(label)label.textContent=(network.role==='spectator'?'Spectating · ':'')+roomConnectionLabel();el.title=network.error||'Online room connection';}"
connection_render_new="function renderRoomConnection(){const el=$('roomConnectionPill');if(!el)return;if(!network){el.hidden=true;el.removeAttribute('data-state');return;}el.hidden=false;el.dataset.state=network.connection||'polling';const dot=el.querySelector('i'),label=el.querySelector('span'),retry=$('roomConnectionRetry');if(dot)dot.setAttribute('aria-hidden','true');if(label)label.textContent=(network.role==='spectator'?'Spectating · ':'')+roomConnectionLabel()+(Number(network.recoveryFailures)>1?' · attempt '+Number(network.recoveryFailures):'');if(retry){retry.hidden=!['reconnecting','offline'].includes(network.connection);retry.disabled=navigator.onLine===false;}el.title=network.error||'Online room connection';}"
if connection_render_old in s:
    s=s.replace(connection_render_old,connection_render_new,1)

healthy_anchor="const healthy=state==='live'||state==='polling';if(healthy){"
if healthy_anchor in s and "network.recoveryFailures=0;network.lastHealthyAt=Date.now();" not in s:
    s=s.replace(healthy_anchor,"const healthy=state==='live'||state==='polling';if(healthy){network.recoveryFailures=0;network.lastHealthyAt=Date.now();",1)

for old,new in [
    ("hadHealthy:false,lastNotifiedRevision:-1};applyRoomState(res.state);","hadHealthy:false,recoveryFailures:0,lastHealthyAt:Date.now(),lastNotifiedRevision:-1};applyRoomState(res.state);"),
    ("restoring:true,hadHealthy:false,lastNotifiedRevision:-1};renderRoomConnection();","restoring:true,hadHealthy:false,recoveryFailures:0,lastHealthyAt:0,lastNotifiedRevision:-1};renderRoomConnection();")
]:
    if old in s:
        s=s.replace(old,new,1)

poll_success="session.error='';applyRoomState(state);"
if poll_success in s and "session.lastHealthyAt=Date.now();applyRoomState(state);" not in s:
    s=s.replace(poll_success,"session.error='';session.recoveryFailures=0;session.lastHealthyAt=Date.now();applyRoomState(state);",1)

poll_error="}else if(navigator.onLine===false){setRoomConnection('offline','No network connection. Your room seat is preserved.');}else setRoomConnection('reconnecting',err.message);"
if poll_error in s:
    s=s.replace(poll_error,"}else if(navigator.onLine===false){setRoomConnection('offline','No network connection. Your room seat is preserved.');}else{session.recoveryFailures=(Number(session.recoveryFailures)||0)+1;setRoomConnection('reconnecting',err.message);}",1)

poll_delay="delay=navigator.onLine===false?5000:live?12000:finished?3000:1000;"
if poll_delay in s:
    s=s.replace(poll_delay,"failures=Number(session.recoveryFailures)||0,delay=navigator.onLine===false?5000:live?12000:finished?3000:failures?Math.min(15000,1000*Math.pow(2,Math.min(4,failures))):1000;",1)

send_retry_old="catch(error){if(network!==session||error.status&&error.status!==503)throw error;state=await roomFetch('/api/rooms/'+encodeURIComponent(session.id)+'/action',payload);}"
send_retry_new="catch(error){const retryable=network===session&&navigator.onLine!==false&&(!error.status||[502,503,504].includes(Number(error.status))||error.name==='AbortError');if(!retryable)throw error;await new Promise(resolve=>setTimeout(resolve,350));state=await roomFetch('/api/rooms/'+encodeURIComponent(session.id)+'/action',payload);}"
if send_retry_old in s:
    s=s.replace(send_retry_old,send_retry_new,1)

fetch_error_old="if(!res.ok)throw Object.assign(Error(data.error||'Room request failed.'),{status:res.status});return data;"
fetch_error_new="if(!res.ok)throw Object.assign(Error(data.error||'Room request failed.'),{status:res.status,requestId:data.requestId||null});return data;"
if fetch_error_old in s:
    s=s.replace(fetch_error_old,fetch_error_new,1)

account_error_old="if(!res.ok)throw Object.assign(Error(data.error||'Player profile request failed.'),{status:res.status});return data;"
account_error_new="if(!res.ok)throw Object.assign(Error(data.error||'Player profile request failed.'),{status:res.status,requestId:data.requestId||null});return data;"
if account_error_old in s:
    s=s.replace(account_error_old,account_error_new,1)

ranked_error_old="if(!res.ok)throw Object.assign(Error(data.error||'Ranked request failed.'),{status:res.status});return data;"
ranked_error_new="if(!res.ok)throw Object.assign(Error(data.error||'Ranked request failed.'),{status:res.status,requestId:data.requestId||null});return data;"
if ranked_error_old in s:
    s=s.replace(ranked_error_old,ranked_error_new,1)

persistence_marker="Result secured for recovery"
if persistence_marker not in s:
    post_anchor="$('roomPostText').textContent=postText;"
    if s.count(post_anchor)!=1:
        raise SystemExit('P13 post-game persistence anchor not unique.')
    persist_ui="const persistence=st.persistence;if(persistence?.status==='persisted')postText+=' · Result saved';else if(persistence)postText+=' · Result secured for recovery'+(Number(persistence.attempts)>0?' · retry '+Number(persistence.attempts):'');"
    s=s.replace(post_anchor,persist_ui+post_anchor,1)

pill_old="document.querySelector('.board-top').insertAdjacentHTML('beforebegin','<div id=\"roomConnectionPill\" class=\"room-connection-pill\" hidden role=\"status\" aria-live=\"polite\"><i></i><span>Connecting…</span></div>');$('platformBtn').onclick=openOnline;"
pill_new="document.querySelector('.board-top').insertAdjacentHTML('beforebegin','<div id=\"roomConnectionPill\" class=\"room-connection-pill\" hidden role=\"status\" aria-live=\"polite\"><i></i><span>Connecting…</span><button class=\"btn ghost\" id=\"roomConnectionRetry\" type=\"button\" hidden>Retry now</button></div>');$('roomConnectionRetry').onclick=retryRoomConnection;$('platformBtn').onclick=openOnline;"
if pill_old in s:
    s=s.replace(pill_old,pill_new,1)

INDEX.write_text(s)

cache='gomoku-v12.5.0-p22-client-resilience-analysis-2.1.0-review-ux-2.1.0'
sw=ROOT/'sw.js'
sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
review=ROOT/'review'/'build.py'
review.write_text(re.sub(r"gomoku-v12\.1\.0-[A-Za-z0-9.\-]+-analysis-2\.1\.0-review-ux-2\.1\.0",cache,review.read_text(),count=1))
print('Embedded P17 release-environment operations console and competitive bridge.')
