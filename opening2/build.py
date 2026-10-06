"""Embed Gomoku 1.8 Opening Study & Repertoire 2.0."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'index.html';html=html_path.read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if 'online-2.0.0' not in cache or 'opening-2.0.0' not in cache:
    raise SystemExit('Opening Study 2.0 requires the v1.7 stack and its own cache boundary.')
assets=[
    ('script','opening2-core',ROOT/'opening2/core.js'),
    ('style','opening2-style',ROOT/'opening2/opening2.css'),
    ('script','opening2-runtime',ROOT/'opening2/runtime.js'),
]
for tag,name,path in assets:
    content=path.read_text()
    if tag=='script' and '</script' in content.lower(): raise SystemExit('Unexpected script terminator in '+str(path))
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{re.escape(name)}">.*?</{tag}>'
    rows=re.findall(pattern,html,re.S)
    if len(rows)>1: raise SystemExit('Duplicate Opening Study 2.0 asset: '+name)
    if rows: html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1: raise SystemExit('Expected one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)
if html.index('id="online2-runtime"')>html.index('id="opening2-runtime"'):
    raise SystemExit('Opening Study 2.0 must load after Online Competition 2.0.')
if html.index('id="opening2-core"')>html.index('id="opening2-runtime"'):
    raise SystemExit('Opening Study core/runtime order invalid.')
html_path.write_text(html)
sw=ROOT/'sw.js';sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.8 Opening Study & Repertoire 2.0.')
