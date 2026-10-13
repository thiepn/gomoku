#!/usr/bin/env python3
"""Canonical standalone embed: E6/E7/E8/E9 followed by E10.
Source maintenance only. Does not run tests, builds, CI or deployment.
"""
from pathlib import Path
import importlib.util
import re

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"


def main():
    previous = ROOT / "bot-elo" / "embed-e9.py"
    spec = importlib.util.spec_from_file_location("gomoku_bot_embed_e9", previous)
    if spec is None or spec.loader is None:
        raise RuntimeError("Canonical E9 embed source missing")
    predecessor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(predecessor)
    predecessor.main()

    html = PAGE.read_text(encoding="utf-8")
    source = (ROOT / "bot-elo" / "exploration-e10.js").read_text(encoding="utf-8")
    if re.search(r"</script", source, flags=re.I):
        raise ValueError("Unsafe E10 inline script terminator")
    first, last = "<!-- BOT-ELO-E10:START -->", "<!-- BOT-ELO-E10:END -->"
    anchor = "<!-- BOT-ELO-E9:END -->"
    if html.count(anchor) != 1:
        raise ValueError("Expected exactly one canonical E9 end marker")
    block = first + "\n<script id=\"bot-elo-e10-native-exploration\">\n" + source + "\n</script>\n" + last
    if html.count(first) == 1 and html.count(last) == 1:
        html = html[:html.index(first)] + block + html[html.index(last) + len(last):]
    elif first not in html and last not in html:
        html = html.replace(anchor, anchor + "\n" + block, 1)
    else:
        raise ValueError("Corrupt E10 embed markers")
    PAGE.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
