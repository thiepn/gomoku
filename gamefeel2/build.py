"""Embed Gomoku 1.4 Game Feel 2.0.

Idempotent and additive: gameplay logic, engine behavior and authored learning
content are not rewritten.
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'index.html';html=html_path.read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if 'ai-2.0.0' not in cache or 'gamefeel-2.0.0' not in cache:
    raise SystemExit('Game Feel 2.0 requires AI 2.0 and the gamefeel-2.0.0 cache boundary.')
assets=[('script','gamefeel2-core',ROOT/'gamefeel2/core.js'),('style','gamefeel2-style',ROOT/'gamefeel2/gamefeel2.css'),('script','gamefeel2-runtime',ROOT/'gamefeel2/runtime.js')]
for tag,name,path in assets:
    content=path.read_text()
    if tag=='script' and '</script' in content.lower(): raise SystemExit('Unexpected script terminator in '+str(path))
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>';pattern=rf'<{tag} id="{re.escape(name)}">.*?</{tag}>'
    rows=re.findall(pattern,html,re.S)
    if len(rows)>1: raise SystemExit('Duplicate Game Feel 2.0 asset: '+name)
    if rows: html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1: raise SystemExit('Expected one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)
if html.index('id="ai2-runtime"')>html.index('id="gamefeel2-runtime"'): raise SystemExit('Game Feel 2.0 must load after AI 2.0.')
if html.index('id="gamefeel2-core"')>html.index('id="gamefeel2-runtime"'): raise SystemExit('Game Feel 2.0 core/runtime order invalid.')
html_path.write_text(html)
sw=ROOT/'sw.js';sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.4 Game Feel 2.0.')
