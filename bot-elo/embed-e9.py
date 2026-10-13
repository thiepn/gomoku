#!/usr/bin/env python3
"""Refresh inherited E6–E8 sources, then embed E9 into standalone Gomoku.
This is a source synchronization helper, NOT a test, build or release command.
"""
from pathlib import Path
import importlib.util
import re

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"


def main():
    previous = ROOT / "bot-elo" / "embed-e8.py"
    spec = importlib.util.spec_from_file_location("gomoku_bot_embed_e8", previous)
    if spec is None or spec.loader is None:
        raise RuntimeError("Canonical E8 embed source is unavailable")
    predecessor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(predecessor)
    predecessor.main()

    html = PAGE.read_text(encoding="utf-8")
    source = (ROOT / "bot-elo" / "journeys-e9.js").read_text(encoding="utf-8")
    if re.search(r"</script", source, flags=re.I):
        raise ValueError("E9 script contains an unsafe embed terminator")
    first = "<!-- BOT-ELO-E9:START -->"
    last = "<!-- BOT-ELO-E9:END -->"
    anchor = "<!-- BOT-ELO-E8:END -->"
    if html.count(anchor) != 1:
        raise ValueError("Expected the original E8 end marker exactly once")
    block = first + "\n<script id=\"bot-elo-e9-decision-journeys\">\n" + source + "\n</script>\n" + last
    if html.count(first) == 1 and html.count(last) == 1:
        html = html[:html.index(first)] + block + html[html.index(last) + len(last):]
    elif first not in html and last not in html:
        html = html.replace(anchor, anchor + "\n" + block, 1)
    else:
        raise ValueError("Missing/corrupt E9 script markers")
    PAGE.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
