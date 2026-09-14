from pathlib import Path
import re

html = Path('index.html').read_text(encoding='utf-8')
m = re.search(r'<script id="rules-engine">([\s\S]*?)</script>', html)
if not m:
    raise SystemExit('rules-engine script not found')
Path('gomoku-rules-engine.js').write_text(m.group(1).strip() + '\n', encoding='utf-8')
print('Extracted rules engine:', len(m.group(1)), 'bytes')
