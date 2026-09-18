"""Guarded, reproducible presentation embedding. Never changes game/course data."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
p=root/'index.html';s=p.read_text()
# Change only the canvas material and stone renderer, not grid geometry or moves.
a=s.index('function bake(){');b=s.index('function drawTri(',a)
s=s[:a]+(root/'ui/board-material.js').read_text()+'\n'+s[b:]
for tag,name,filename in [('style','tournament-table-style','studio.css'),('script','tournament-table-script','studio.js')]:
    content=(root/'ui'/filename).read_text()
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{name}">.*?</{tag}>'
    if re.search(pattern,s,re.S):s=re.sub(pattern,lambda _:block,s,count=1,flags=re.S)
    else:
        if s.count('</body>')!=1:raise SystemExit('Expected exactly one closing body.')
        s=s.replace('</body>',block+'\n</body>')
# Apply tokens before the first paint; feature-dependent elements wait for mounting.
body=re.search(r'<body\b[^>]*>',s)
if not body:raise SystemExit('Body missing')
if 'ui-studio' not in body.group():
    new=body.group()
    if 'class="' in new:new=new.replace('class="','class="ui-studio ',1)
    else:new=new.replace('<body','<body class="ui-studio"',1)
    s=s[:body.start()]+new+s[body.end():]
s=re.sub(r'(<meta name="theme-color" content=")[^"]+("[^>]*>)',r'\g<1>#192420\2',s,count=1)
p.write_text(s)
# Keep the existing review builder and this builder on one PWA cache version.
r=root/'review/build.py';t=re.sub(r"gomoku-v12\.1\.0-review-1\.0\.0(?:-table-[A-Za-z0-9.\-]+)?",'gomoku-v12.1.0-analysis-2.1.0-review-ux-2.1.0',r.read_text())
# Avoid repeated suffixes if the source is already migrated.
t=t.replace('-table-1.0.0-table-1.0.0','-table-1.0.0');r.write_text(t)
sw=root/'sw.js';t=sw.read_text();t=re.sub(r"const CACHE_NAME = '[^']+';","const CACHE_NAME = 'gomoku-v12.1.0-analysis-2.1.0-review-ux-2.1.0';",t,count=1);sw.write_text(t)
print('Embedded Tournament Table 1.0.1; visual system preserved and Renju center-first enforcement repaired.')
# Match installed app chrome to the shared visual identity.
import json
manifest=root/'manifest.webmanifest';data=json.loads(manifest.read_text())
data.update(name='Gomoku Studio',description='Play, study, and review five-in-a-row. Your own Gomoku table.',background_color='#192420',theme_color='#192420')
manifest.write_text(json.dumps(data,indent=2)+'\n')
