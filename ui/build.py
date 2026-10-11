"""Guarded, reproducible presentation embedding. Never changes game/course data."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
cache=(root/'client-cache-version.txt').read_text().strip()
if not cache.startswith('gomoku-'):raise SystemExit('Invalid client cache version.')
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
# U2 owner-approved Precision Arena layered after Tournament Table, without changing
# its APIs or the game state. Deterministic source-only, never an external asset.
for tag,name,filename in [('style','precision-arena-style','arena.css'),('script','precision-arena-script','arena.js')]:
    content=(root/'ui'/filename).read_text()
    if '</'+tag in content.lower():raise SystemExit('Unsafe inline terminator in '+filename)
    block=f'<{tag} id="{name}">\n{content}\n</{tag}>'
    pattern=rf'<{tag} id="{name}">.*?</{tag}>'
    if re.search(pattern,s,re.S):s=re.sub(pattern,lambda _:block,s,count=1,flags=re.S)
    else:
        if s.count('</body>')!=1:raise SystemExit('Expected exactly one closing body for '+name)
        s=s.replace('</body>',block+'\n</body>',1)
# The original V11.7 resilience audit expects exactly three visible destinations.
# U2 adds the fourth approved destination. Change only this *scoped* invariant;
# every readiness, storage, board and accessibility check stays byte-identical.
health_begin=s.index('<script id="v117-resilience-script">')
health_end=s.index('</script>',health_begin)
health=s[health_begin:health_end]
old_nav="const primary=[...document.querySelectorAll('#v92Primary button')].filter(b=>getComputedStyle(b).display!=='none');if(primary.length!==3)issues.push('Primary navigation exposes '+primary.length+' visible destinations instead of 3.');"
new_nav="const primary=[...document.querySelectorAll('#v92Primary button')].filter(b=>getComputedStyle(b).display!=='none');const expectedNav=window.GomokuArena?.version==='2.0.0-u2'&&window.GomokuArena.destinations?.join(',')==='play,analyze,learn,library'&&document.querySelectorAll('#v92Primary button[data-v92-route]').length===3&&document.getElementById('arenaAnalyze')?.getAttribute('aria-label')==='Analyze'?4:3;if(primary.length!==expectedNav)issues.push('Primary navigation exposes '+primary.length+' visible destinations instead of '+expectedNav+'.');"
if old_nav in health:health=health.replace(old_nav,new_nav)
elif new_nav not in health:raise SystemExit('Unexpected resilience audit; refusing silent change.')
s=s[:health_begin]+health+s[health_end:]
import hashlib
health_script=re.search(r'<script id="v117-resilience-script">(.*?)</script>',s,re.S)
print('U2_V117_SHA256='+hashlib.sha256(health_script.group(1).encode()).hexdigest())

# Apply tokens before the first paint; feature-dependent elements wait for mounting.
body=re.search(r'<body\b[^>]*>',s)
if not body:raise SystemExit('Body missing')
if 'ui-studio' not in body.group():
    new=body.group()
    if 'class="' in new:new=new.replace('class="','class="ui-studio ',1)
    else:new=new.replace('<body','<body class="ui-studio"',1)
    s=s[:body.start()]+new+s[body.end():]
# Pre-paint opt-in on the isolated U2 branch. Keep original classes and settings.
if 'ui-arena' not in s[body.start():body.start()+300]:
    body2=re.search(r'<body\b[^>]*>',s)
    tag=body2.group()
    tag=tag.replace('class="','class="ui-arena ',1) if 'class="' in tag else tag.replace('<body','<body class="ui-arena"',1)
    s=s[:body2.start()]+tag+s[body2.end():]
s=re.sub(r'(<meta name="theme-color" content=")[^"]+("[^>]*>)',r'\g<1>#111b20\2',s,count=1)
p.write_text(s)
# Keep the existing review builder and this builder on one PWA cache version.
r=root/'review/build.py';t=re.sub(r"gomoku-v12\.1\.0-review-1\.0\.0(?:-table-[A-Za-z0-9.\-]+)?",cache,r.read_text())
# Avoid repeated suffixes if the source is already migrated.
t=t.replace('-table-1.0.0-table-1.0.0','-table-1.0.0');r.write_text(t)
sw=root/'sw.js';t=sw.read_text();t=re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",t,count=1);sw.write_text(t)
print('Embedded owner-approved Precision Arena U2; Tournament Table and game behavior preserved.')
# Match installed app chrome to the shared visual identity.
import json
manifest=root/'manifest.webmanifest';data=json.loads(manifest.read_text())
data.update(name='Gomoku Studio',description='Play, study, and review five-in-a-row. Your own Gomoku table.',background_color='#111b20',theme_color='#111b20')
manifest.write_text(json.dumps(data,indent=2)+'\n')
