#!/usr/bin/env python3
"""Canonical standalone embedding of inherited E6/E7 plus native-review E8.
Source refresh only. Does not execute tests, builds, CI or deployments.
"""
from pathlib import Path
import importlib.util
import re

ROOT = Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"


def main():
    predecessor = ROOT / "bot-elo" / "embed-e7.py"
    spec = importlib.util.spec_from_file_location("gomoku_embed_e7", predecessor)
    if spec is None or spec.loader is None:
        raise RuntimeError("Canonical E7 embedding entrypoint unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.main()

    text = PAGE.read_text(encoding="utf-8")
    source = (ROOT / "bot-elo" / "review-e8.js").read_text(encoding="utf-8")
    if re.search(r"</script", source, flags=re.I):
        raise ValueError("E8 content cannot safely be embedded inline")
    start, end = "<!-- BOT-ELO-E8:START -->", "<!-- BOT-ELO-E8:END -->"
    anchor = "<!-- BOT-ELO-E7:END -->"
    if text.count(anchor) != 1:
        raise ValueError("Expected one E7 end marker")
    block = start + "\n<script id=\"bot-elo-e8-native-review\">\n" + source + "\n</script>\n" + end
    if text.count(start) == 1 and text.count(end) == 1:
        text = text[:text.index(start)] + block + text[text.index(end) + len(end):]
    elif start not in text and end not in text:
        text = text.replace(anchor, anchor + "\n" + block, 1)
    else:
        raise ValueError("Corrupt E8 marker pair")
    PAGE.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
