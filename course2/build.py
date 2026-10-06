"""Build the portable Gomoku 1.2 Course 2.0 artifact."""
from pathlib import Path
import re
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]

subprocess.run([sys.executable,str(ROOT/'learning/build.py')],cwd=ROOT,check=True)

html_path=ROOT/'index.html'
html=html_path.read_text()
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
    matches=re.findall(pattern,html,re.S)
    if len(matches)>1:
        raise SystemExit('Duplicate Course 2.0 asset: '+name)
    if matches:
        html=re.sub(pattern,lambda _:block,html,count=1,flags=re.S)
    else:
        if html.count('</body>')!=1:
            raise SystemExit('Expected exactly one closing body.')
        html=html.replace('</body>',block+'\n</body>',1)

if html.index('id="learning-intelligence-runtime"')>html.index('id="course2-core"'):
    raise SystemExit('Course 2.0 must load after Learning Intelligence.')
if html.index('id="course2-core"')>html.index('id="course2-runtime"'):
    raise SystemExit('Course 2.0 core/runtime order is invalid.')

html_path.write_text(html)
cache=(ROOT/'client-cache-version.txt').read_text().strip()
sw=ROOT/'sw.js'
sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded Gomoku 1.2 Course 2.0: animated walkthroughs, transfer checks, Learning Intelligence evidence.')
