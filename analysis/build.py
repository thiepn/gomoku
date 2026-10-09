"""Guarded embedding of Analysis 2.0 into the existing portable application.
Run after review/build.py and ui/build.py. No gameplay or course code changes.
"""
from pathlib import Path
# P9 release reproducibility marker: all builders must preserve the generated competition shell.
import re,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
cache=(ROOT/'client-cache-version.txt').read_text().strip()
if not cache.startswith('gomoku-'):raise SystemExit('Invalid client cache version.')
p=ROOT/'index.html';s=p.read_text()
for name,file,anchor in [('analysis2-core','core.js','<script id="guided-review-script">'),('analysis2-runtime','runtime.js','<script id="guided-review-script">'),('analysis2-training','training.js','</body>')]:
    text=(ROOT/'analysis'/file).read_text()
    if '</script' in text.lower():raise SystemExit('Unexpected script terminator in '+file)
    block=f'<script id="{name}">\n{text}\n</script>'
    pattern=rf'<script id="{name}">.*?</script>'
    matches=re.findall(pattern,s,re.S)
    if len(matches)>1:raise SystemExit('Duplicate script: '+name)
    if matches:s=re.sub(pattern,lambda _:block,s,count=1,flags=re.S)
    else:
        if s.count(anchor)!=1:raise SystemExit('Missing unique anchor '+anchor)
        s=s.replace(anchor,block+'\n'+anchor,1)
# A6 runtime policy loads before the transactional background worker.
policy=(ROOT/'analysis3/runtime-policy.js').read_text()
if '</script' in policy.lower():raise SystemExit('Unexpected A6 policy script close')
policy_block='<script id="analysis6-runtime-policy">\n'+policy+'\\n</script>'
if '<script id="analysis6-runtime-policy">' in s:
    s=re.sub(r'<script id="analysis6-runtime-policy">.*?</script>',lambda _:policy_block,s,count=1,flags=re.S)
else:
    needle='<script id="analysis2-runtime">'
    if s.count(needle)!=1:raise SystemExit('Missing unique analysis runtime anchor')
    s=s.replace(needle,policy_block+'\n'+needle,1)
# Embed the independent A5 planner before the saved-mistake training runtime.
planner=(ROOT/'analysis3/practice-core.js').read_text()
if '</script' in planner.lower():raise SystemExit('A5 planner contains script terminator')
anchor='<script id="analysis2-training">'
if s.count(anchor)!=1:raise SystemExit('Training anchor mismatch: cannot embed A5')
a5_block='<script id="analysis5-practice-core">\n'+planner+'\n</script>'
if '<script id="analysis5-practice-core">' in s:
    s=re.sub(r'<script id="analysis5-practice-core">.*?</script>',lambda _:a5_block,s,count=1,flags=re.S)
else:
    s=s.replace(anchor,a5_block+'\n'+anchor,1)
planner_css=(ROOT/'analysis3/practice.css').read_text()
a5_css='<style id="analysis5-practice-style">\n'+planner_css+'\n</style>'
if '<style id="analysis5-practice-style">' in s:
    s=re.sub(r'<style id="analysis5-practice-style">.*?</style>',lambda _:a5_css,s,count=1,flags=re.S)
else:
    if s.count('</body>')!=1:raise SystemExit('Missing unique A5 CSS anchor')
    s=s.replace('</body>',a5_css+'\n</body>',1)
text=(ROOT/'analysis/analysis.css').read_text();block=f'<style id="analysis2-style">\n{text}\n</style>'
if '<style id="analysis2-style">' in s:s=re.sub(r'<style id="analysis2-style">.*?</style>',lambda _:block,s,count=1,flags=re.S)
else:s=s.replace('</body>',block+'\n</body>')
p.write_text(s)
sw=ROOT/'sw.js';sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';",f"const CACHE_NAME = '{cache}';",sw.read_text(),count=1))
print('Embedded A5 practice planner above existing A2 training UI with source parity.')
