#!/usr/bin/env python3
"""Embed the two E1 canonical scripts in the legacy standalone HTML.
Run manually: python bot-elo/embed.py
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
PAGE=ROOT/"index.html"
START="<!-- BOT-ELO-E1:START -->"
END="<!-- BOT-ELO-E1:END -->"
def main():
    html=PAGE.read_text(encoding="utf-8")
    blocks=[]
    for file in ("rating.js","preview.js"):
        content=(ROOT/"bot-elo"/file).read_text(encoding="utf-8")
        if re.search(r"</script",content,re.I):
            raise ValueError("Embedded source contains a script terminator")
        blocks.append('<script id="bot-elo-e1-'+file[:-3]+'">\n'+content+'\n</script>')
    chunk=START+'\n'+'\n'.join(blocks)+'\n'+END
    if START in html or END in html:
        if html.count(START)!=1 or html.count(END)!=1:raise ValueError("Corrupt E1 embed bounds")
        html=html[:html.index(START)]+chunk+html[html.index(END)+len(END):]
    else:
        closing="</body></html>"
        if html.count(closing)!=1:raise ValueError("Cannot locate unique closing body")
        html=html.replace(closing,chunk+'\n'+closing,1)
    PAGE.write_text(html,encoding="utf-8")
if __name__=="__main__":main()
