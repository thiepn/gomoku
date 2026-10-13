#!/usr/bin/env python3
"""Synchronize the E2 trusted-play UI into the existing standalone HTML app.
E1 and the original game canvas/rules remain untouched.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
START="<!-- BOT-ELO-E2:START -->"
END="<!-- BOT-ELO-E2:END -->"
ANCHOR="<!-- BOT-ELO-E1:END -->"
def main():
    page=ROOT/"index.html"
    html=page.read_text(encoding="utf-8")
    js=(ROOT/"bot-elo/trusted-play.js").read_text(encoding="utf-8")
    if re.search(r"</script",js,re.I):raise ValueError("Unsafe inline script terminator")
    snippet=START+'\n<script id="bot-elo-e2-trusted-play">\n'+js+'\n</script>\n'+END
    if START in html or END in html:
        if html.count(START)!=1 or html.count(END)!=1:raise ValueError("Invalid E2 boundaries")
        html=html[:html.index(START)]+snippet+html[html.index(END)+len(END):]
    else:
        if html.count(ANCHOR)!=1:raise ValueError("E1 embed missing")
        html=html.replace(ANCHOR,ANCHOR+'\n'+snippet,1)
    page.write_text(html,encoding="utf-8")
if __name__=="__main__":main()
