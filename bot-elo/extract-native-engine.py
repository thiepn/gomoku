#!/usr/bin/env python3
"""Mirror the *original* Studio rules+search kernel for trusted E2 bot play.

Canonical source is index.html <script id="rules-engine">. The generated
server module must stay byte-for-byte equivalent before its final ES export.
This generator does not implement new AI algorithms and does not run tests.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent.parent
HTML=ROOT/"index.html"
TARGET=ROOT/"supabase/functions/gomoku-room/native-bot-engine.js"
PREFIX="""/* AUTO-EXTRACTED byte-for-byte from index.html script#rules-engine (parent E1).
 * Do not edit independently. bot-elo/extract-native-engine.py is the only maintenance path.
 * Shares the genuine client search and rules code; no alternate AI evaluator.
 */
"""
SUFFIX="\nexport { createEngine as createNativeBotEngine };\n"

def main():
    src=HTML.read_text(encoding="utf-8")
    pat=r'<script id="rules-engine">([\s\S]*?)</script>'
    matches=list(re.finditer(pat,src))
    if len(matches)!=1:raise ValueError("Cannot find a unique native rules-engine script")
    original=matches[0].group(1)
    if len(original)<20000 or "function chooseMove(" not in original:
        raise ValueError("Original native search implementation is missing")
    TARGET.write_text(PREFIX+original+SUFFIX,encoding="utf-8")

if __name__=="__main__":main()
