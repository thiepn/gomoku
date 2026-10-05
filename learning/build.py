"""Embed Gomoku 1.1 Learning Intelligence into the portable app.

Idempotent and deliberately additive: existing game, course, review, analysis and
competition scripts are not rewritten.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'index.html'
html=html_path.read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if not cache.startswith('gomoku-'):
    raise SystemExit('Invalid client cache version.')

assets=[
    ('script','learning-intelligence-core',ROOT/'learning/core.js'),
    ('style','learning-intelligence-style',ROOT/'learning/learning.css'),
    ('script','learning-intelligence-runtime',ROOT/'learning/runtime.js'),
]
for tag,name,path in assets:
    content=path.read_text()
    if tag=='script' and '</script' in content.lower():
        raise SystemExit('Unexpected script terminator in '+str(path))
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{re.escape(name)}">.*?</{tag}>'
    matches=re.findall(pattern,html,re.S)
    if len(matches)>1:
        raise SystemExit('Duplicate learning asset: '+name)
    if matches:
        html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1:
            raise SystemExit('Expected exactly one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)

# Core must execute before the browser runtime.
if html.index('id="learning-intelligence-core"')>html.index('id="learning-intelligence-runtime"'):
    raise SystemExit('Learning core/runtime order is invalid.')

html_path.write_text(html)
sw=ROOT/'sw.js'
sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.1 Learning Intelligence: skill graph, mastery, prescriptions, Learn + Review integration.')
