"""Embed Gomoku 1.2 Course 2.0 into the portable app.

Idempotent and additive. The 14 existing course modules stay untouched.
"""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
html_path=ROOT/'index.html'
html=html_path.read_text()
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if 'learning-1.1.0' not in cache or 'course-2.0.0' not in cache:
    raise SystemExit('Course 2.0 requires the v1.1 learning cache boundary.')

assets=[
    ('script','course2-core',ROOT/'course2/core.js'),
    ('style','course2-style',ROOT/'course2/course2.css'),
    ('script','course2-runtime',ROOT/'course2/runtime.js'),
]
for tag,name,path in assets:
    content=path.read_text()
    if tag=='script' and '</script' in content.lower():
        raise SystemExit('Unexpected script terminator in '+str(path))
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{re.escape(name)}">.*?</{tag}>'
    rows=re.findall(pattern,html,re.S)
    if len(rows)>1:
        raise SystemExit('Duplicate Course 2.0 asset: '+name)
    if rows:
        html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1:
            raise SystemExit('Expected one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)

if html.index('id="learning-intelligence-runtime"')>html.index('id="course2-runtime"'):
    raise SystemExit('Course 2.0 runtime must execute after v1.1 Learning Intelligence.')
if html.index('id="course2-core"')>html.index('id="course2-runtime"'):
    raise SystemExit('Course 2.0 core/runtime order is invalid.')

html_path.write_text(html)
sw=ROOT/'sw.js'
sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.2 Course 2.0.')
