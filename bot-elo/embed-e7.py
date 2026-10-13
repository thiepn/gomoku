#!/usr/bin/env python3
"""Refresh canonical bot E6/E2/E4/E5 scripts, then embed E7 training.
Source-only operation; no tests, builds, migrations, network or deployment.
"""
from pathlib import Path
import importlib.util
import re

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"


def main():
    previous = ROOT / "bot-elo" / "embed-e6.py"
    spec = importlib.util.spec_from_file_location("gomoku_bot_embed_e6", previous)
    if spec is None or spec.loader is None:
        raise RuntimeError("E6 embed source not found")
    e6 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(e6)
    e6.main()
    html = PAGE.read_text(encoding="utf-8")
    content = (ROOT / "bot-elo" / "training-e7.js").read_text(encoding="utf-8")
    if re.search(r"</script", content, flags=re.I):
        raise ValueError("Unsafe E7 source for inline script")
    begin = "<!-- BOT-ELO-E7:START -->"
    end = "<!-- BOT-ELO-E7:END -->"
    marker = "<!-- BOT-ELO-E5:END -->"
    if html.count(marker) != 1:
        raise ValueError("Expected exactly one existing E5 script")
    block = begin + "\n<script id=\"bot-elo-e7-training\">\n" + content + "\n</script>\n" + end
    if html.count(begin) == 1 and html.count(end) == 1:
        html = html[:html.index(begin)] + block + html[html.index(end) + len(end):]
    elif begin not in html and end not in html:
        html = html.replace(marker, marker + "\n" + block, 1)
    else:
        raise ValueError("Corrupt E7 script boundary")
    PAGE.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
