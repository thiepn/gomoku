#!/usr/bin/env python3
"""Re-embed E6 command-only continuity and canonical E2/E4/E5 sources into
the existing standalone Gomoku UI. No builds, tests, network or migrations.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
PAGE=ROOT/"index.html"
MODULES=[
 ("E6","bot-elo-e6-command-continuity","bot-elo/command-continuity-e6.js"),
 ("E2","bot-elo-e2-trusted-play","bot-elo/trusted-play.js"),
 ("E4","bot-elo-e4-owner-rating","bot-elo/account-rating.js"),
 ("E5","bot-elo-e5-workspace","bot-elo/experience-e5.js")
]
def main():
    html=PAGE.read_text(encoding="utf-8")
    # Extend the EXISTING authenticated bridge with its established session
    # user id, never a new login or private token. E6 uses this only for
    # client-side isolation; the backend still verifies every request.
    old="account:()=>({connected:roomAccountState.connected===true,username:roomAccountState.profile?.username||null}),"
    new="account:()=>({connected:roomAccountState.connected===true,username:roomAccountState.profile?.username||null,userId:roomAccountState.session?.user?.id||null}),"
    if old in html:html=html.replace(old,new,1)
    elif new not in html:raise ValueError("Original Account bridge is unavailable")
    for phase,element,path in MODULES:
        content=(ROOT/path).read_text(encoding="utf-8")
        if re.search(r"</script",content,re.I):raise ValueError("Unsafe source "+path)
        start=f"<!-- BOT-ELO-{phase}:START -->"
        end=f"<!-- BOT-ELO-{phase}:END -->"
        block=start+"\n"+f'<script id="{element}">\n'+content+"\n</script>\n"+end
        if html.count(start)==1 and html.count(end)==1:
            html=html[:html.index(start)]+block+html[html.index(end)+len(end):]
        elif phase=="E6" and html.count(start)==0 and html.count(end)==0:
            anchor="<!-- BOT-ELO-E2:START -->"
            if html.count(anchor)!=1:raise ValueError("E2 entry missing")
            html=html.replace(anchor,block+"\n"+anchor,1)
        else:raise ValueError("Corrupt or missing "+phase+" embed")
    PAGE.write_text(html,encoding="utf-8")
if __name__=="__main__":main()
