#!/usr/bin/env python3
"""Embed the E4 owner-scoped Bot Elo account panel in standalone index.html.

Uses canonical bot-elo/account-rating.js as source and requires E2 embed.
This does not invoke tests, builds, migrations, network or deployments.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent.parent
START="<!-- BOT-ELO-E4:START -->"
END="<!-- BOT-ELO-E4:END -->"
ANCHOR="<!-- BOT-ELO-E2:END -->"
def main():
    page=ROOT/"index.html"
    html=page.read_text(encoding="utf-8")
    js=(ROOT/"bot-elo/account-rating.js").read_text(encoding="utf-8")
    if re.search(r"</script",js,re.I):raise ValueError("Unsafe E4 script terminator")
    snippet=START+'\n<script id="bot-elo-e4-owner-rating">\n'+js+'\n</script>\n'+END
    if START in html or END in html:
        if html.count(START)!=1 or html.count(END)!=1:raise ValueError("Invalid E4 bounds")
        html=html[:html.index(START)]+snippet+html[html.index(END)+len(END):]
    else:
        if html.count(ANCHOR)!=1:raise ValueError("Missing original E2 embed")
        html=html.replace(ANCHOR,ANCHOR+'\n'+snippet,1)
    page.write_text(html,encoding="utf-8")
if __name__=="__main__":main()
