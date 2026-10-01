"""P10 competitive identity bridge + UI embedding.

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
    account:()=>({connected:roomAccountState.connected===true,username:roomAccountState.profile?.username||null}),
    detail:async id=>{const token=roomAccountToken();if(!token)return null;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);try{const res=await fetch(ROOM_API_BASE+'/api/tournaments/'+encodeURIComponent(id),{headers:{apikey:ROOM_API_KEY,'X-Gomoku-Account-Token':token},signal:controller.signal,cache:'no-store'}),data=await res.json();if(!res.ok)throw Object.assign(Error(data.error||'Tournament request failed.'),{status:res.status});return data.tournament||null;}finally{clearTimeout(timer);}},
    enterTournament:async data=>{if(!data?.id||!data?.state)return false;if(network&&network.id===data.id)return true;if(network){toast('Leave the current room before opening a tournament match.');return false;}if(S.records.length&&!await archiveGame(true)){toast('Export or save the current game before opening the tournament match.');return false;}await enterRoom({...data,accountBound:true});return true;},
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

for tag,ident,filename in [
    ('style','p8-competition-style','p8-competition.css'),
    ('script','p8-competition-script','p8-competition.js')
]:
    content=(ROOT/'online'/filename).read_text()
    block=f'<{tag} id="{ident}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{re.escape(ident)}">.*?</{tag}>'
    if re.search(pattern,s,re.S):
        s=re.sub(pattern,lambda _:block,s,count=1,flags=re.S)
    else:
        if s.count('</body>')!=1:raise SystemExit('Expected one closing body tag.')
        s=s.replace('</body>',block+'\n</body>',1)


# Route the existing verified-player profile entrypoint into the richer P10 profile.
profile_start='  async function openPlayerProfile(username){'
profile_end='  function bindRoomProfileName(el,player){'
a=s.find(profile_start)
b=s.find(profile_end,a)
if a<0 or b<0:
    raise SystemExit('P10 player profile bridge anchors not found.')
fallback=s[a:b]
delegate="if(window.GomokuCompetition?.openPlayerProfile)return window.GomokuCompetition.openPlayerProfile(username);"
if delegate not in fallback:
    delegated=profile_start+delegate+fallback[len(profile_start):]
    s=s[:a]+delegated+s[b:]

INDEX.write_text(s)

cache='gomoku-v12.1.0-p10-competitive-identity-analysis-2.1.0-review-ux-2.1.0'
sw=ROOT/'sw.js'
sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
review=ROOT/'review'/'build.py'
review.write_text(re.sub(r"gomoku-v12\.1\.0-[A-Za-z0-9.\-]+-analysis-2\.1\.0-review-ux-2\.1\.0",cache,review.read_text(),count=1))
print('Embedded P10 competitive identity UI and core bridge.')
