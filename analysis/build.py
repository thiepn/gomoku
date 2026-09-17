"""Guarded embedding of Analysis 2.0 into the existing portable application.
Run after review/build.py and ui/build.py. No gameplay or course code changes.
"""
from pathlib import Path
import re,hashlib,json
ROOT=Path(__file__).resolve().parents[1]
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
text=(ROOT/'analysis/analysis.css').read_text();block=f'<style id="analysis2-style">\n{text}\n</style>'
if '<style id="analysis2-style">' in s:s=re.sub(r'<style id="analysis2-style">.*?</style>',lambda _:block,s,count=1,flags=re.S)
else:s=s.replace('</body>',block+'\n</body>')
p.write_text(s)
sw=ROOT/'sw.js';sw.write_text(re.sub(r"const CACHE_NAME = '[^']+';","const CACHE_NAME = 'gomoku-v12.1.0-analysis-2.0.0-table-1.0.1-renju';",sw.read_text(),count=1))
print('Embedded Analysis 2.0 worker, evidence viewer and private mistake training.')
