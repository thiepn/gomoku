#!/usr/bin/env python3
"""Keep native E2/E4 code and E5 account-first workspace in standalone index.html.

Source-of-truth: bot-elo/trusted-play.js, bot-elo/account-rating.js,
bot-elo/experience-e5.js. No network, build, tests or external services.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent.parent
PAGE=ROOT/"index.html"
SOURCES=(
  ("E2","bot-elo-e2-trusted-play","bot-elo/trusted-play.js"),
  ("E4","bot-elo-e4-owner-rating","bot-elo/account-rating.js"),
  ("E5","bot-elo-e5-workspace","bot-elo/experience-e5.js")
)
def block(phase,element,path):
    js=(ROOT/path).read_text(encoding="utf-8")
    if re.search(r"</script",js,re.I):raise ValueError("Unsafe script closer in "+path)
    return f'<!-- BOT-ELO-{phase}:START -->\n<script id="{element}">\n{js}\n</script>\n<!-- BOT-ELO-{phase}:END -->'
def main():
    html=PAGE.read_text(encoding="utf-8")
    for phase,element,path in SOURCES:
        start=f"<!-- BOT-ELO-{phase}:START -->"
        end=f"<!-- BOT-ELO-{phase}:END -->"
        content=block(phase,element,path)
        if html.count(start)==1 and html.count(end)==1:
            html=html[:html.index(start)]+content+html[html.index(end)+len(end):]
        elif phase=="E5" and html.count(start)==0 and html.count(end)==0:
            anchor="<!-- BOT-ELO-E4:END -->"
            if html.count(anchor)!=1:raise ValueError("E4 embed missing")
            html=html.replace(anchor,anchor+"\n"+content,1)
        else:raise ValueError("Invalid or missing "+phase+" boundaries")
    PAGE.write_text(html,encoding="utf-8")
if __name__=="__main__":main()
